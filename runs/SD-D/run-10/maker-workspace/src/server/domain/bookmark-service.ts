import { randomUUID } from 'node:crypto';
import type {
  BookmarkCreateInput,
  BookmarkDetail,
  BookmarkPatchInput,
} from '../../shared/contracts/bookmarks.js';
import { AppError } from '../api/errors.js';
import {
  toDetail,
  type BookmarkCursor,
  type BookmarkRepository,
} from '../repositories/bookmark-repository.js';
import type { MediaService } from '../media/media-service.js';
import type { MediaRow } from '../repositories/media-repository.js';
import type { OrganizationService } from './organization-service.js';
import type { SearchIndexService } from '../search/search-index-service.js';
import { markdownToPlainText } from './note-text.js';
import { normalizeBookmarkUrl } from './url-normalization.js';

export class BookmarkService {
  constructor(
    private readonly bookmarks: BookmarkRepository,
    private readonly media: MediaService,
    private readonly organization: OrganizationService,
    private readonly index: SearchIndexService,
  ) {}

  list(
    userId: number,
    options: { cursor?: string; limit: number },
  ): { items: BookmarkDetail[]; page: { nextCursor: string | null; hasMore: boolean; total: number } } {
    const cursor = options.cursor ? this.decodeCursor(options.cursor) : undefined;
    const result = this.bookmarks.listActive(userId, options.limit, cursor);
    return {
      items: result.items.map(toDetail),
      page: {
        nextCursor: result.next
          ? Buffer.from(JSON.stringify(result.next), 'utf8').toString('base64url')
          : null,
        hasMore: result.hasMore,
        total: result.total,
      },
    };
  }

  get(userId: number, publicId: string): BookmarkDetail {
    const record = this.bookmarks.getOwned(userId, publicId);
    if (!record) throw new AppError(404, 'bookmark_not_found', 'Bookmark was not found.');
    return toDetail(record);
  }

  async create(userId: number, input: BookmarkCreateInput): Promise<BookmarkDetail> {
    const url = normalizeBookmarkUrl(input.url);
    const organization = this.organization.resolveForBookmark(
      userId,
      input.tagIds,
      input.newTagNames,
      input.collectionId,
    );
    const duplicate = this.bookmarks.findByNormalizedUrl(userId, url.normalized);
    if (duplicate) {
      throw new AppError(409, 'duplicate_bookmark', 'This destination is already in your library.', {
        existingBookmark: {
          id: duplicate.id,
          title: duplicate.title,
          archived: Boolean(duplicate.archivedAt),
        },
      });
    }
    const favicon = input.faviconAssetId
      ? this.media.getOwned(input.faviconAssetId, userId, 'favicon')
      : null;
    const preview = input.previewAssetId
      ? this.media.getOwned(input.previewAssetId, userId, 'preview')
      : null;
    const promoted: MediaRow[] = [];
    try {
      if (favicon && (await this.media.promote(favicon))) promoted.push(favicon);
      if (preview && (await this.media.promote(preview))) promoted.push(preview);
      const record = this.bookmarks.create({
        publicId: `bmk_${randomUUID()}`,
        userId,
        url: url.original,
        normalizedUrl: url.normalized,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        noteMarkdown: input.noteMarkdown?.trim() || null,
        notePlain: markdownToPlainText(input.noteMarkdown),
        faviconAssetId: favicon?.id ?? null,
        previewAssetId: preview?.id ?? null,
        collectionId: organization.collectionId,
        tagIds: organization.tagIds,
        isFavorite: input.isFavorite,
        readingState: input.readingState,
      });
      this.index.refresh(record.internalId);
      return toDetail(this.bookmarks.getOwned(userId, record.id)!);
    } catch (error) {
      await this.revertPromotions(promoted);
      const again = this.bookmarks.findByNormalizedUrl(userId, url.normalized);
      if (again) {
        throw new AppError(409, 'duplicate_bookmark', 'This destination is already in your library.', {
          existingBookmark: { id: again.id, title: again.title, archived: Boolean(again.archivedAt) },
        });
      }
      throw error;
    }
  }

  async update(userId: number, publicId: string, input: BookmarkPatchInput): Promise<BookmarkDetail> {
    const current = this.bookmarks.getOwned(userId, publicId);
    if (!current) throw new AppError(404, 'bookmark_not_found', 'Bookmark was not found.');
    if (current.version !== input.expectedVersion) {
      throw new AppError(409, 'stale_version', 'This bookmark changed in another session.', {
        current: this.get(userId, publicId),
      });
    }
    const normalized = normalizeBookmarkUrl(input.url ?? current.url);
    const duplicate = this.bookmarks.findByNormalizedUrl(userId, normalized.normalized);
    if (duplicate && duplicate.id !== publicId) {
      throw new AppError(409, 'duplicate_bookmark', 'This destination is already in your library.', {
        existingBookmark: {
          id: duplicate.id,
          title: duplicate.title,
          archived: Boolean(duplicate.archivedAt),
        },
      });
    }
    const favicon =
      input.faviconAssetId === undefined
        ? current.favicon
          ? this.media.getOwned(current.favicon.id, userId, 'favicon')
          : null
        : input.faviconAssetId
          ? this.media.getOwned(input.faviconAssetId, userId, 'favicon')
          : null;
    const preview =
      input.previewAssetId === undefined
        ? current.previewImage
          ? this.media.getOwned(current.previewImage.id, userId, 'preview')
          : null
        : input.previewAssetId
          ? this.media.getOwned(input.previewAssetId, userId, 'preview')
          : null;
    const organization = this.organization.resolveForBookmark(
      userId,
      input.tagIds ?? current.tags.map((tag) => tag.id),
      input.newTagNames ?? [],
      input.collectionId === undefined ? current.collection?.id : input.collectionId,
    );
    const promoted: MediaRow[] = [];
    let updated;
    try {
      if (favicon && (await this.media.promote(favicon))) promoted.push(favicon);
      if (preview && (await this.media.promote(preview))) promoted.push(preview);
      updated = this.bookmarks.update(userId, publicId, input.expectedVersion, {
        url: normalized.original,
        normalizedUrl: normalized.normalized,
        title: input.title?.trim() ?? current.title,
        description:
          input.description === undefined ? current.description : input.description?.trim() || null,
        noteMarkdown:
          input.noteMarkdown === undefined ? current.noteMarkdown : input.noteMarkdown?.trim() || null,
        notePlain:
          input.noteMarkdown === undefined ? current.notePlain : markdownToPlainText(input.noteMarkdown),
        faviconAssetId: favicon?.id ?? null,
        previewAssetId: preview?.id ?? null,
        collectionId: organization.collectionId,
        tagIds: organization.tagIds,
        isFavorite: input.isFavorite ?? current.isFavorite,
        readingState: input.readingState ?? current.readingState,
      });
    } catch (error) {
      await this.revertPromotions(promoted);
      throw error;
    }
    if (!updated) {
      await this.revertPromotions(promoted);
      throw new AppError(409, 'stale_version', 'This bookmark changed in another session.', {
        current: this.get(userId, publicId),
      });
    }
    this.index.refresh(updated.internalId);
    return toDetail(this.bookmarks.getOwned(userId, updated.id)!);
  }

  private async revertPromotions(promoted: MediaRow[]): Promise<void> {
    for (const media of promoted.reverse()) await this.media.revertPromotion(media);
  }

  private decodeCursor(value: string): BookmarkCursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<BookmarkCursor>;
      if (
        !Number.isSafeInteger(parsed.createdAt) ||
        !Number.isSafeInteger(parsed.internalId) ||
        Number(parsed.createdAt) < 0 ||
        Number(parsed.internalId) < 1
      ) {
        throw new Error('invalid cursor');
      }
      return { createdAt: parsed.createdAt!, internalId: parsed.internalId! };
    } catch {
      throw new AppError(422, 'invalid_cursor', 'The bookmark page cursor is invalid.');
    }
  }
}
