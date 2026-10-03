import type Database from 'better-sqlite3';
import type { BookmarkRepository } from './bookmark-repository.js';
import type { SelectionService } from './selection-service.js';
import type { z } from 'zod';
import type { BulkRequestSchema } from '@shared/contracts.js';
type Bulk = z.infer<typeof BulkRequestSchema>;
export class BulkService {
  constructor(
    private db: Database.Database,
    private repo: BookmarkRepository,
    private selections: SelectionService
  ) {}
  apply(request: Bulk) {
    const ids = this.selections.resolve(request.selection);
    let changed = 0,
      unchanged = 0;
    const tx = this.db.transaction(() => {
      for (const id of ids) {
        const b = this.repo.get(id);
        if (!b) continue;
        const a = request.action;
        if (a.type === 'markRead') {
          if (b.isRead === a.value) unchanged++;
          else {
            this.repo.update(id, { isRead: a.value });
            changed++;
          }
        } else if (a.type === 'archive') {
          if (b.archivedAt) unchanged++;
          else {
            this.repo.update(id, { archived: true });
            changed++;
          }
        } else if (a.type === 'restore') {
          if (!b.archivedAt) unchanged++;
          else {
            this.repo.update(id, { archived: false });
            changed++;
          }
        } else if (a.type === 'delete') {
          this.repo.delete(id) ? changed++ : unchanged++;
        } else {
          const current = b.tags.map((t) => t.name);
          const target =
            a.type === 'addTags'
              ? [...new Set([...current, ...a.tags])]
              : current.filter(
                  (t) => !a.tags.some((x) => x.toLocaleLowerCase() === t.toLocaleLowerCase())
                );
          if (target.length === current.length) unchanged++;
          else {
            this.repo.update(id, { tags: target });
            changed++;
          }
        }
      }
      return { matched: ids.length, changed, unchanged };
    });
    return tx();
  }
}
