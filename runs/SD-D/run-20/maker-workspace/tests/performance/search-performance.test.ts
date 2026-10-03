import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { seedPerformanceDatabase } from '../../db/seeds/performance';
import { BookmarkRepository } from '../../src/server/repositories/bookmarkRepository';
import { temporaryDatabase } from '../fixtures/database';
it('returns at least 95 percent of 100 visible search/filter/sort samples within one second at 10k bookmarks', () => {
  const fixture = temporaryDatabase();
  seedPerformanceDatabase(fixture.db);
  const repository = new BookmarkRepository(fixture.db);
  const durations: number[] = [];
  for (let index = 0; index < 100; index++) {
    const start = performance.now();
    repository.list({
      view: index % 4 === 0 ? 'unread' : 'active',
      q: index % 3 === 0 ? 'needle' : 'Bookmark',
      tag: [],
      sort: index % 2 === 0 ? 'title' : 'savedAt',
      direction: index % 2 === 0 ? 'asc' : 'desc',
      page: 1,
      pageSize: 50,
    });
    durations.push(performance.now() - start);
  }
  expect(durations.filter((duration) => duration < 1000).length).toBeGreaterThanOrEqual(95);
  fixture.close();
}, 30_000);
