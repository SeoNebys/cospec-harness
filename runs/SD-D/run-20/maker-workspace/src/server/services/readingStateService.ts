import type { BookmarkService } from './bookmarkService.js';
export class ReadingStateService {
  constructor(private bookmarks: BookmarkService) {}
  mark(id: string, readingState: 'none' | 'unread' | 'read') {
    return this.bookmarks.update(id, { readingState });
  }
}
