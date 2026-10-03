import type { BookmarkRepository, ListOptions } from './bookmark-repository.js';

/** Dedicated boundary for composed collection retrieval; SQL remains centralized in BookmarkRepository. */
export class SearchRepository {
  constructor(private bookmarks: BookmarkRepository) {}
  search(userId: string, options: ListOptions, ftsExpression?: string) {
    return this.bookmarks.list(userId, options, ftsExpression);
  }
}
