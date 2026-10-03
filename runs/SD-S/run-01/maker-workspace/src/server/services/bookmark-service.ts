import { randomUUID } from 'node:crypto';
import type { Bookmark, BookmarkList, CreateBookmarkInput, ListCriteria, UpdateBookmarkInput } from '../../shared/api-types.js';
import { ApiError } from '../errors.js';
import { BookmarkRepository, type StoredBookmarkInput } from '../repositories/bookmark-repository.js';
import { normalizeTagFilter, normalizeTags, normalizeUrl } from './normalization.js';

export class BookmarkService {
  constructor(
    private readonly repository: BookmarkRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createId: () => string = randomUUID,
  ) {}

  list(criteria: ListCriteria): BookmarkList {
    return this.repository.list({ ...criteria, tag: criteria.tag ? normalizeTagFilter(criteria.tag) : null });
  }

  create(input: CreateBookmarkInput): Bookmark {
    const normalizedUrl = normalizeUrl(input.url);
    const duplicate = this.repository.findActiveDuplicate(normalizedUrl);
    if (duplicate && !input.allowDuplicate) {
      throw new ApiError(409, 'DUPLICATE_BOOKMARK', 'This address is already in your active bookmarks.', {
        details: { existingBookmark: duplicate },
      });
    }
    const timestamp = this.now();
    return this.repository.create({
      id: this.createId(),
      url: normalizedUrl,
      normalizedUrl,
      title: input.title.trim(),
      notes: input.notes.trim(),
      tags: normalizeTags(input.tags),
      isFavorite: false,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    });
  }

  update(id: string, input: UpdateBookmarkInput): Bookmark {
    const current = this.requireBookmark(id);
    const url = input.url === undefined ? current.url : normalizeUrl(input.url);
    const duplicate = this.repository.findActiveDuplicate(url, id);
    if (current.status === 'active' && duplicate) {
      throw new ApiError(409, 'DUPLICATE_BOOKMARK', 'Another active bookmark already uses this address.', {
        details: { existingBookmark: duplicate },
      });
    }
    const stored: StoredBookmarkInput = {
      id: current.id,
      url,
      normalizedUrl: url,
      title: input.title === undefined ? current.title : input.title.trim(),
      notes: input.notes === undefined ? current.notes : input.notes.trim(),
      tags: normalizeTags(input.tags ?? current.tags),
      isFavorite: input.isFavorite ?? current.isFavorite,
      status: current.status,
      createdAt: current.createdAt,
      updatedAt: this.now(),
      archivedAt: current.archivedAt,
    };
    return this.repository.update(stored)!;
  }

  archive(id: string): Bookmark {
    const current = this.requireBookmark(id);
    if (current.status === 'archived') throw new ApiError(409, 'BOOKMARK_ALREADY_ARCHIVED', 'This bookmark is already archived.');
    return this.repository.archive(id, this.now())!;
  }

  restore(id: string): Bookmark {
    const current = this.requireBookmark(id);
    if (current.status === 'active') throw new ApiError(409, 'BOOKMARK_ALREADY_ACTIVE', 'This bookmark is already active.');
    return this.repository.restore(id, this.now())!;
  }

  delete(id: string): void {
    const current = this.requireBookmark(id);
    if (current.status !== 'archived') throw new ApiError(409, 'BOOKMARK_NOT_ARCHIVED', 'Archive this bookmark before deleting it permanently.');
    this.repository.deleteArchived(id);
  }

  private requireBookmark(id: string): Bookmark {
    const bookmark = this.repository.getById(id);
    if (!bookmark) throw new ApiError(404, 'BOOKMARK_NOT_FOUND', 'That bookmark no longer exists.');
    return bookmark;
  }
}
