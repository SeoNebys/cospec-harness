import { AppError } from '../api/errors.js';
import { toDetail, type BookmarkRepository } from '../repositories/bookmark-repository.js';

export class BookmarkStateService {
  constructor(private readonly bookmarks: BookmarkRepository) {}

  setReading(userId: number, id: string, expectedVersion: number, readingState: 'none' | 'unread' | 'read') {
    return this.change(userId, id, expectedVersion, { readingState });
  }

  setFavorite(userId: number, id: string, expectedVersion: number, isFavorite: boolean) {
    return this.change(userId, id, expectedVersion, { isFavorite });
  }

  private change(
    userId: number,
    id: string,
    expectedVersion: number,
    changes: { readingState?: 'none' | 'unread' | 'read'; isFavorite?: boolean },
  ) {
    const current = this.bookmarks.getOwned(userId, id);
    if (!current) throw new AppError(404, 'bookmark_not_found', 'Bookmark was not found.');
    if (current.version !== expectedVersion)
      throw new AppError(409, 'stale_version', 'This bookmark changed in another session.', {
        current: toDetail(current),
      });
    const updated = this.bookmarks.updateState(userId, id, expectedVersion, changes);
    if (!updated) throw new AppError(409, 'stale_version', 'This bookmark changed in another session.');
    return toDetail(updated);
  }
}
