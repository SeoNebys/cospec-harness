import { randomUUID } from 'node:crypto';
import { AppError } from '../api/errors.js';
import type { CollectionRepository } from '../repositories/collection-repository.js';
import type { TagRepository, TagRow } from '../repositories/tag-repository.js';
import type { SearchIndexService } from '../search/search-index-service.js';

export function normalizeOrganizationName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

export class OrganizationService {
  constructor(
    private readonly tags: TagRepository,
    private readonly collections: CollectionRepository,
    private readonly index: SearchIndexService,
  ) {}

  listTags(userId: number, suggest = '', limit = 50) {
    return { items: this.tags.list(userId, suggest, limit) };
  }
  listCollections(userId: number) {
    return { items: this.collections.list(userId) };
  }

  createTag(userId: number, name: string) {
    const clean = name.trim().replace(/\s+/gu, ' ');
    const normalized = normalizeOrganizationName(clean);
    const existing = this.tags.getByNormalized(userId, normalized);
    if (existing) return { status: 200 as const, created: false, tag: this.summary(existing) };
    const row = this.tags.create(userId, `tag_${randomUUID()}`, clean, normalized);
    return { status: 201 as const, created: true, tag: this.summary(row) };
  }

  renameTag(userId: number, publicId: string, expectedVersion: number, name: string) {
    const row = this.requireTag(userId, publicId);
    if (row.version !== expectedVersion) throw this.stale('tag');
    const clean = name.trim().replace(/\s+/gu, ' ');
    const normalized = normalizeOrganizationName(clean);
    const collision = this.tags.getByNormalized(userId, normalized);
    if (collision && collision.id !== row.id) {
      throw new AppError(409, 'tag_merge_required', 'A tag with that name already exists.', {
        targetTag: this.summary(collision),
        impact: this.tags.impact(userId, publicId),
      });
    }
    const changed = this.tags.rename(userId, publicId, expectedVersion, clean, normalized);
    if (!changed) throw this.stale('tag');
    this.refreshTagBookmarks(row.id);
    return this.summary(changed);
  }

  mergeTag(userId: number, publicId: string, expectedVersion: number, targetId: string) {
    const source = this.requireTag(userId, publicId);
    const target = this.requireTag(userId, targetId);
    if (source.version !== expectedVersion) throw this.stale('tag');
    if (source.id === target.id) throw new AppError(422, 'invalid_merge', 'Choose a different target tag.');
    const affected = this.bookmarkIdsForTags([source.id, target.id]);
    const result = this.tags.merge(userId, source, target);
    this.index.refreshMany(affected);
    return { tag: this.summary(this.requireTag(userId, target.publicId)), ...result };
  }

  tagImpact(userId: number, publicId: string) {
    const impact = this.tags.impact(userId, publicId);
    if (!impact) throw new AppError(404, 'tag_not_found', 'Tag was not found.');
    return impact;
  }

  deleteTag(
    userId: number,
    publicId: string,
    expectedVersion: number,
    expectedBookmarks: number,
    expectedSearches: number,
  ): void {
    const row = this.requireTag(userId, publicId);
    if (row.version !== expectedVersion) throw this.stale('tag');
    const impact = this.tagImpact(userId, publicId);
    if (impact.bookmarkCount !== expectedBookmarks || impact.savedSearchCount !== expectedSearches) {
      throw new AppError(409, 'selection_changed', 'The tag impact changed. Review the new counts.', {
        impact,
      });
    }
    const affected = this.bookmarkIdsForTags([row.id]);
    this.tags.delete(userId, row);
    this.index.refreshMany(affected);
  }

  createCollection(userId: number, name: string) {
    const clean = name.trim().replace(/\s+/gu, ' ');
    const normalized = normalizeOrganizationName(clean);
    if (this.collections.getByNormalized(userId, normalized))
      throw new AppError(409, 'duplicate_collection', 'A collection with that name already exists.');
    const row = this.collections.create(userId, `col_${randomUUID()}`, clean, normalized);
    return {
      id: row.publicId,
      name: row.name,
      activeBookmarkCount: 0,
      archivedBookmarkCount: 0,
      version: row.version,
    };
  }

  renameCollection(userId: number, publicId: string, expectedVersion: number, name: string) {
    const row = this.requireCollection(userId, publicId);
    if (row.version !== expectedVersion) throw this.stale('collection');
    const clean = name.trim().replace(/\s+/gu, ' ');
    const normalized = normalizeOrganizationName(clean);
    const collision = this.collections.getByNormalized(userId, normalized);
    if (collision && collision.id !== row.id)
      throw new AppError(409, 'duplicate_collection', 'A collection with that name already exists.');
    const updated = this.collections.rename(userId, publicId, expectedVersion, clean, normalized);
    if (!updated) throw this.stale('collection');
    return { id: updated.publicId, name: updated.name, version: updated.version };
  }

  collectionImpact(userId: number, publicId: string) {
    const count = this.collections.impact(userId, publicId);
    if (count === null) throw new AppError(404, 'collection_not_found', 'Collection was not found.');
    return { bookmarkCount: count };
  }

  deleteCollection(userId: number, publicId: string, expectedVersion: number, expectedCount: number): void {
    const row = this.requireCollection(userId, publicId);
    if (row.version !== expectedVersion) throw this.stale('collection');
    const count = this.collectionImpact(userId, publicId).bookmarkCount;
    if (count !== expectedCount)
      throw new AppError(409, 'selection_changed', 'The collection impact changed.', {
        bookmarkCount: count,
      });
    this.collections.deleteAndUnfile(userId, row);
  }

  resolveForBookmark(
    userId: number,
    tagIds: string[],
    newTagNames: string[],
    collectionId: string | null | undefined,
  ) {
    const resolved = new Map<number, TagRow>();
    for (const publicId of tagIds) {
      const tag = this.requireTag(userId, publicId);
      resolved.set(tag.id, tag);
    }
    for (const name of newTagNames) {
      if (name.trim().startsWith('#') || name.trim().length > 64)
        throw new AppError(422, 'invalid_tag', 'Enter tag names without # and use 64 characters or fewer.');
      const created = this.createTag(userId, name);
      const tag = this.requireTag(userId, created.tag.id);
      resolved.set(tag.id, tag);
    }
    if (resolved.size > 50) throw new AppError(422, 'tag_limit', 'A bookmark can have at most 50 tags.');
    const collection = collectionId ? this.requireCollection(userId, collectionId) : null;
    return { tagIds: [...resolved.keys()], collectionId: collection?.id ?? null };
  }

  private requireTag(userId: number, publicId: string) {
    const row = this.tags.getOwned(userId, publicId);
    if (!row) throw new AppError(404, 'tag_not_found', 'Tag was not found.');
    return row;
  }
  private requireCollection(userId: number, publicId: string) {
    const row = this.collections.getOwned(userId, publicId);
    if (!row) throw new AppError(404, 'collection_not_found', 'Collection was not found.');
    return row;
  }
  private summary(row: TagRow) {
    return {
      id: row.publicId,
      name: row.name,
      bookmarkCount: this.tags.impact(row.userId, row.publicId)?.bookmarkCount ?? 0,
      version: row.version,
    };
  }
  private stale(resource: string) {
    return new AppError(409, 'stale_version', `This ${resource} changed in another session.`);
  }
  private bookmarkIdsForTags(tagIds: number[]): number[] {
    return this.tags.bookmarkIds(tagIds);
  }
  private refreshTagBookmarks(tagId: number) {
    this.index.refreshMany(this.bookmarkIdsForTags([tagId]));
  }
}
