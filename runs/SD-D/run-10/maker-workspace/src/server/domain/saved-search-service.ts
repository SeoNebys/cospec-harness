import { randomUUID } from 'node:crypto';
import { AppError } from '../api/errors.js';
import type { SearchCriteria } from '../../shared/contracts/search.js';
import { searchCriteriaSchema } from '../../shared/contracts/search.js';
import type { SavedSearchRepository, SavedSearchRecord } from '../repositories/saved-search-repository.js';
import type { SearchRepository } from '../repositories/search-repository.js';
import type { TagRepository } from '../repositories/tag-repository.js';
import type { CollectionRepository } from '../repositories/collection-repository.js';
import { normalizeOrganizationName } from './organization-service.js';
import { parseSearch } from '../search/parser.js';

export class SavedSearchService {
  constructor(
    private readonly repository: SavedSearchRepository,
    private readonly search: SearchRepository,
    private readonly tags: TagRepository,
    private readonly collections: CollectionRepository,
  ) {}
  list(userId: number) {
    return { items: this.repository.list(userId).map((r) => this.present(r)) };
  }
  get(userId: number, id: string) {
    return this.present(this.require(userId, id));
  }
  create(userId: number, name: string, criteriaInput: SearchCriteria) {
    const normalized = normalizeOrganizationName(name);
    if (this.repository.getByNormalized(userId, normalized))
      throw new AppError(409, 'duplicate_saved_search', 'A saved search with that name already exists.');
    const resolved = this.resolve(userId, criteriaInput);
    const row = this.repository.create({
      publicId: `ss_${randomUUID()}`,
      userId,
      name: name.trim(),
      normalized,
      ...resolved,
    });
    return this.present(row);
  }
  update(userId: number, id: string, expectedVersion: number, name?: string, criteriaInput?: SearchCriteria) {
    const current = this.require(userId, id);
    if (current.version !== expectedVersion)
      throw new AppError(409, 'stale_version', 'This saved search changed in another session.', {
        current: this.present(current),
      });
    const nextName = name?.trim() ?? current.name;
    const normalized = normalizeOrganizationName(nextName);
    const collision = this.repository.getByNormalized(userId, normalized);
    if (collision && collision.id !== current.id)
      throw new AppError(409, 'duplicate_saved_search', 'A saved search with that name already exists.');
    const resolved = this.resolve(userId, criteriaInput ?? current.criteria);
    const row = this.repository.update({
      userId,
      publicId: id,
      expectedVersion,
      name: nextName,
      normalized,
      ...resolved,
    });
    if (!row) throw new AppError(409, 'stale_version', 'This saved search changed in another session.');
    return this.present(row);
  }
  delete(userId: number, id: string, expectedVersion: number) {
    const current = this.require(userId, id);
    if (current.version !== expectedVersion || !this.repository.delete(userId, id, expectedVersion))
      throw new AppError(409, 'stale_version', 'This saved search changed in another session.');
  }
  private resolve(userId: number, input: SearchCriteria) {
    const criteria = searchCriteriaSchema.parse(input);
    parseSearch(criteria.query);
    const includeTagIds = criteria.includeTagIds.map((id) => this.requireTag(userId, id));
    const excludeTagIds = criteria.excludeTagIds.map((id) => this.requireTag(userId, id));
    if (includeTagIds.some((id) => excludeTagIds.includes(id)))
      throw new AppError(422, 'invalid_filters', 'A tag cannot be included and excluded.');
    let collectionId: null | number = null;
    if (criteria.collection.mode === 'id') {
      const collection = this.collections.getOwned(userId, criteria.collection.id);
      if (!collection) throw new AppError(404, 'collection_not_found', 'Collection was not found.');
      collectionId = collection.id;
    }
    return { criteria, includeTagIds, excludeTagIds, collectionId };
  }
  private requireTag(userId: number, id: string) {
    const tag = this.tags.getOwned(userId, id);
    if (!tag) throw new AppError(404, 'tag_not_found', 'Tag was not found.');
    return tag.id;
  }
  private require(userId: number, id: string) {
    const row = this.repository.getOwned(userId, id);
    if (!row) throw new AppError(404, 'saved_search_not_found', 'Saved search was not found.');
    return row;
  }
  private present(row: SavedSearchRecord) {
    return {
      id: row.publicId,
      name: row.name,
      criteria: row.criteria,
      matchCount: this.search.search(row.userId, row.criteria, 1).page.total,
      version: row.version,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }
}
