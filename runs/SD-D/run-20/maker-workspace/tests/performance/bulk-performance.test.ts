import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { seedPerformanceDatabase } from '../../db/seeds/performance';
import { BulkActionService } from '../../src/server/services/bulkActionService';
import { temporaryDatabase } from '../fixtures/database';
it('evaluates 100 explicit bookmarks in under 30 seconds', () => {
  const fixture = temporaryDatabase();
  seedPerformanceDatabase(fixture.db, 100);
  const ids = (
    fixture.db.prepare('select public_id from bookmarks').all() as Array<{ public_id: string }>
  ).map((row) => row.public_id);
  const start = performance.now();
  const result = new BulkActionService(fixture.db).apply({ bookmarkIds: ids, action: 'markUnread' });
  expect(result.changedIds.length + result.unchangedIds.length).toBe(100);
  expect(performance.now() - start).toBeLessThan(30_000);
  fixture.close();
});
