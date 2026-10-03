import type { AppDatabase } from '../db/database.js';
import type { BulkAction } from '../../shared/contracts/bulk.js';
import type { SearchIndexService } from '../search/search-index-service.js';

export type ConfirmationRow = {
  id: number;
  userId: number;
  tokenHash: string;
  action: string;
  selectionJson: string;
  criteriaDigest: string;
  expectedCount: number;
  expiresAt: number;
  consumedAt: number | null;
};
export class BulkRepository {
  constructor(
    private readonly database: AppDatabase,
    private readonly index: SearchIndexService,
  ) {}
  createConfirmation(
    userId: number,
    tokenHash: string,
    action: string,
    selectionJson: string,
    digest: string,
    count: number,
    expiresAt: number,
  ) {
    this.database
      .prepare(
        'INSERT INTO bulk_confirmations(user_id,token_hash,action,selection_json,criteria_digest,expected_count,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)',
      )
      .run(userId, tokenHash, action, selectionJson, digest, count, Date.now(), expiresAt);
  }
  getConfirmation(userId: number, tokenHash: string): ConfirmationRow | null {
    const r = this.database
      .prepare(
        'SELECT * FROM bulk_confirmations WHERE user_id=? AND token_hash=? AND consumed_at IS NULL AND expires_at>?',
      )
      .get(userId, tokenHash, Date.now()) as Record<string, unknown> | undefined;
    return r
      ? {
          id: r.id as number,
          userId: r.user_id as number,
          tokenHash: r.token_hash as string,
          action: r.action as string,
          selectionJson: r.selection_json as string,
          criteriaDigest: r.criteria_digest as string,
          expectedCount: r.expected_count as number,
          expiresAt: r.expires_at as number,
          consumedAt: r.consumed_at as number | null,
        }
      : null;
  }
  consume(id: number) {
    return (
      this.database
        .prepare('UPDATE bulk_confirmations SET consumed_at=? WHERE id=? AND consumed_at IS NULL')
        .run(Date.now(), id).changes > 0
    );
  }
  apply(
    userId: number,
    items: Array<{ id: string; version: number }>,
    action: BulkAction,
    tagInternalIds: number[] = [],
  ) {
    return this.database.transaction(() => {
      const failures: Array<{ id: string; code: string; message: string }> = [];
      let succeeded = 0;
      for (const item of items) {
        const row = this.database
          .prepare('SELECT id,version,archived_at FROM bookmarks WHERE user_id=? AND public_id=?')
          .get(userId, item.id) as { id: number; version: number; archived_at: number | null } | undefined;
        if (!row) {
          failures.push({ id: item.id, code: 'not_found', message: 'Bookmark was not found.' });
          continue;
        }
        if (row.version !== item.version) {
          failures.push({
            id: item.id,
            code: 'stale_version',
            message: 'Bookmark changed before the action ran.',
          });
          continue;
        }
        if (action.type === 'archive' && row.archived_at) {
          failures.push({ id: item.id, code: 'already_archived', message: 'Bookmark is already archived.' });
          continue;
        }
        if (action.type === 'restore' && !row.archived_at) {
          failures.push({ id: item.id, code: 'already_active', message: 'Bookmark is already active.' });
          continue;
        }
        const now = Date.now();
        if (action.type === 'reading.set')
          this.database
            .prepare('UPDATE bookmarks SET reading_state=?,updated_at=?,version=version+1 WHERE id=?')
            .run(action.value, now, row.id);
        if (action.type === 'favorite.set')
          this.database
            .prepare('UPDATE bookmarks SET is_favorite=?,updated_at=?,version=version+1 WHERE id=?')
            .run(action.value ? 1 : 0, now, row.id);
        if (action.type === 'archive')
          this.database
            .prepare('UPDATE bookmarks SET archived_at=?,updated_at=?,version=version+1 WHERE id=?')
            .run(now, now, row.id);
        if (action.type === 'restore')
          this.database
            .prepare('UPDATE bookmarks SET archived_at=NULL,updated_at=?,version=version+1 WHERE id=?')
            .run(now, row.id);
        if (action.type === 'tags.add') {
          const currentCount = this.database
            .prepare('SELECT COUNT(*) FROM bookmark_tags WHERE bookmark_id=?')
            .pluck()
            .get(row.id) as number;
          const newCount = tagInternalIds.filter(
            (tag) =>
              !this.database
                .prepare('SELECT 1 FROM bookmark_tags WHERE bookmark_id=? AND tag_id=?')
                .get(row.id, tag),
          ).length;
          if (currentCount + newCount > 50) {
            failures.push({
              id: item.id,
              code: 'tag_limit',
              message: 'A bookmark can have at most 50 tags.',
            });
            continue;
          }
          const insert = this.database.prepare(
            'INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id,created_at) VALUES(?,?,?)',
          );
          for (const tag of tagInternalIds) insert.run(row.id, tag, now);
          this.database
            .prepare('UPDATE bookmarks SET updated_at=?,version=version+1 WHERE id=?')
            .run(now, row.id);
          this.index.refresh(row.id);
        }
        if (action.type === 'tags.remove') {
          const remove = this.database.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=? AND tag_id=?');
          for (const tag of tagInternalIds) remove.run(row.id, tag);
          this.database
            .prepare('UPDATE bookmarks SET updated_at=?,version=version+1 WHERE id=?')
            .run(now, row.id);
          this.index.refresh(row.id);
        }
        if (action.type === 'delete_permanently') {
          this.database.prepare('DELETE FROM bookmark_search WHERE rowid=?').run(row.id);
          this.database.prepare('DELETE FROM bookmarks WHERE id=?').run(row.id);
        }
        succeeded += 1;
      }
      return { succeeded, failures };
    })();
  }
  cleanup(now = Date.now()) {
    return this.database
      .prepare('DELETE FROM bulk_confirmations WHERE expires_at<=? OR consumed_at IS NOT NULL')
      .run(now).changes;
  }
}
