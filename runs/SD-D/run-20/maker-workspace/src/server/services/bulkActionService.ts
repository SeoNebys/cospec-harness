import type { BulkActionInput } from '../../shared/schemas/api.js';
import type { AppDatabase } from '../db/connection.js';
import { BookmarkRepository } from '../repositories/bookmarkRepository.js';
import { inTransaction, timestamp } from '../repositories/database.js';
import { normalizeTag } from '../search/compile.js';

export class BulkActionService {
  private bookmarks: BookmarkRepository;
  constructor(private db: AppDatabase) {
    this.bookmarks = new BookmarkRepository(db);
  }
  apply(input: BulkActionInput) {
    const changedIds: string[] = [];
    const unchangedIds: string[] = [];
    const failures: Array<{ bookmarkId: string; code: string; message: string }> = [];
    inTransaction(this.db, () => {
      for (const publicId of input.bookmarkIds) {
        const row = this.bookmarks.byId(publicId);
        if (!row) {
          failures.push({ bookmarkId: publicId, code: 'NOT_FOUND', message: 'Bookmark not found.' });
          continue;
        }
        if (input.action === 'delete') {
          if (row.lifecycle_state !== 'archived') {
            failures.push({
              bookmarkId: publicId,
              code: 'NOT_ARCHIVED',
              message: 'Only archived bookmarks can be permanently deleted.',
            });
            continue;
          }
          this.bookmarks.delete(row.id);
          changedIds.push(publicId);
          continue;
        }
        if (input.action === 'archive' || input.action === 'restore') {
          const target = input.action === 'archive' ? 'archived' : 'active';
          if (row.lifecycle_state === target) {
            unchangedIds.push(publicId);
            continue;
          }
          this.bookmarks.update(row.id, {
            lifecycle_state: target,
            archived_at: target === 'archived' ? timestamp() : null,
            updated_at: timestamp(),
          });
          changedIds.push(publicId);
          continue;
        }
        if (input.action === 'markRead' || input.action === 'markUnread') {
          const target = input.action === 'markRead' ? 'read' : 'unread';
          if (row.reading_state === target) {
            unchangedIds.push(publicId);
            continue;
          }
          this.bookmarks.update(row.id, { reading_state: target, updated_at: timestamp() });
          changedIds.push(publicId);
          continue;
        }
        const existing = this.bookmarks.toDto(row).tags.map((tag) => tag.label);
        const map = new Map(existing.map((label) => [normalizeTag(label), label]));
        if (input.action === 'addTags')
          for (const label of input.tagLabels ?? [])
            map.set(normalizeTag(label), label.trim().replace(/\s+/g, ' '));
        else for (const label of input.tagLabels ?? []) map.delete(normalizeTag(label));
        if (map.size > 20) {
          failures.push({
            bookmarkId: publicId,
            code: 'TAG_LIMIT',
            message: 'A bookmark can have at most 20 tags.',
          });
          continue;
        }
        const next = [...map.values()];
        if (
          next.length === existing.length &&
          next.every((label) => existing.some((item) => normalizeTag(item) === normalizeTag(label)))
        ) {
          unchangedIds.push(publicId);
          continue;
        }
        this.bookmarks.update(row.id, { updated_at: timestamp() }, next);
        changedIds.push(publicId);
      }
    });
    return { requestedCount: input.bookmarkIds.length, changedIds, unchangedIds, failures };
  }
}
