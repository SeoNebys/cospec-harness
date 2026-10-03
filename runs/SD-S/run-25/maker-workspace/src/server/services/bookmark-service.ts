import type {
  Bookmark,
  BookmarkInput,
  BookmarkList,
  BookmarkListQuery,
  TagList,
} from '../../shared/contracts.js';
import { normalizeBookmarkUrl, normalizeTags } from '../../shared/normalization.js';
import {
  bookmarkIdSchema,
  bookmarkInputSchema,
  bookmarkListQuerySchema,
  readingStateSchema,
} from '../../shared/schemas.js';
import type { BookmarkRepository } from '../db/bookmark-repository.js';

export class DuplicateBookmarkError extends Error {
  public readonly statusCode = 409;
  public readonly code = 'DUPLICATE_URL';

  constructor(public readonly existingBookmark: Bookmark) {
    super('This web address is already saved in your library.');
  }
}

export class BookmarkNotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly code = 'BOOKMARK_NOT_FOUND';

  constructor() {
    super('The requested bookmark was not found.');
  }
}

export class BookmarkService {
  constructor(private readonly repository: BookmarkRepository) {}

  createBookmark(input: BookmarkInput): Bookmark {
    const validated = bookmarkInputSchema.parse(input);
    const normalizedUrl = normalizeBookmarkUrl(validated.url);
    const tags = normalizeTags(validated.tags);

    const duplicate = this.repository.findDuplicate(normalizedUrl.urlKey);
    if (duplicate && !validated.allowDuplicate) throw new DuplicateBookmarkError(duplicate);

    return this.repository.create({
      url: normalizedUrl.url,
      urlKey: normalizedUrl.urlKey,
      title: validated.title,
      description: validated.description,
      tags,
      readingState: validated.readingState,
    });
  }

  replaceBookmark(bookmarkId: string, input: BookmarkInput): Bookmark {
    const id = bookmarkIdSchema.parse(bookmarkId);
    const validated = bookmarkInputSchema.parse(input);
    const normalizedUrl = normalizeBookmarkUrl(validated.url);
    const duplicate = this.repository.findDuplicate(normalizedUrl.urlKey, id);
    if (duplicate && !validated.allowDuplicate) throw new DuplicateBookmarkError(duplicate);

    const bookmark = this.repository.replace(id, {
      url: normalizedUrl.url,
      urlKey: normalizedUrl.urlKey,
      title: validated.title,
      description: validated.description,
      tags: normalizeTags(validated.tags),
      readingState: validated.readingState,
    });
    if (!bookmark) throw new BookmarkNotFoundError();
    return bookmark;
  }

  getBookmark(bookmarkId: string): Bookmark {
    const id = bookmarkIdSchema.parse(bookmarkId);
    const bookmark = this.repository.get(id);
    if (!bookmark) throw new BookmarkNotFoundError();
    return bookmark;
  }

  listBookmarks(query: BookmarkListQuery = {}): BookmarkList {
    const validated = bookmarkListQuerySchema.parse(query);
    const items = this.repository.list(validated);
    return { items, total: items.length };
  }

  listTags(): TagList {
    return { items: this.repository.listTags() };
  }

  deleteBookmark(bookmarkId: string): void {
    const id = bookmarkIdSchema.parse(bookmarkId);
    if (!this.repository.delete(id)) throw new BookmarkNotFoundError();
  }

  updateReadingState(bookmarkId: string, readingState: unknown): Bookmark {
    const id = bookmarkIdSchema.parse(bookmarkId);
    const state = readingStateSchema.parse(readingState);
    const bookmark = this.repository.updateReadingState(id, state);
    if (!bookmark) throw new BookmarkNotFoundError();
    return bookmark;
  }
}
