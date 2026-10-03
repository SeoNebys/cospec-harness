import { AppError } from '../api/errors.js';
import { toDetail, type BookmarkRepository } from '../repositories/bookmark-repository.js';

export class ArchiveService {
  constructor(private readonly bookmarks: BookmarkRepository) {}

  archive(userId: number, id: string, expectedVersion: number) {
    const current = this.require(userId, id);
    if (current.version !== expectedVersion)
      throw new AppError(409, 'stale_version', 'This bookmark changed in another session.', {
        current: toDetail(current),
      });
    if (current.archivedAt) throw new AppError(409, 'invalid_state', 'This bookmark is already archived.');
    return this.transition(userId, id, expectedVersion, Date.now());
  }
  restore(userId: number, id: string, expectedVersion: number) {
    const current = this.require(userId, id);
    if (current.version !== expectedVersion)
      throw new AppError(409, 'stale_version', 'This bookmark changed in another session.', {
        current: toDetail(current),
      });
    if (!current.archivedAt) throw new AppError(409, 'invalid_state', 'This bookmark is already active.');
    return this.transition(userId, id, expectedVersion, null);
  }
  delete(userId: number, id: string, expectedVersion: number): void {
    const current = this.require(userId, id);
    if (current.version !== expectedVersion)
      throw new AppError(409, 'stale_version', 'This bookmark changed in another session.', {
        current: toDetail(current),
      });
    if (!this.bookmarks.deleteOwned(userId, id, expectedVersion))
      throw new AppError(409, 'stale_version', 'This bookmark changed in another session.');
  }
  private transition(userId: number, id: string, expectedVersion: number, archivedAt: number | null) {
    const current = this.require(userId, id);
    if (current.version !== expectedVersion)
      throw new AppError(409, 'stale_version', 'This bookmark changed in another session.', {
        current: toDetail(current),
      });
    const updated = this.bookmarks.updateState(userId, id, expectedVersion, { archivedAt });
    if (!updated) throw new AppError(409, 'stale_version', 'This bookmark changed in another session.');
    return toDetail(updated);
  }
  private require(userId: number, id: string) {
    const item = this.bookmarks.getOwned(userId, id);
    if (!item) throw new AppError(404, 'bookmark_not_found', 'Bookmark was not found.');
    return item;
  }
}
