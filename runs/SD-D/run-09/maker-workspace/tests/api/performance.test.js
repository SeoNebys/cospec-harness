import { describe, it, expect, beforeEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
let insertBookmark;

beforeEach(async () => {
  agent = await freshAgent();
  ({ insertBookmark } = await import('../../src/server/services/bookmarks.js'));
  // Seed ~1,000 bookmarks directly for speed.
  for (let i = 0; i < 1000; i += 1) {
    insertBookmark({
      url: `https://example.com/page-${i}`,
      normalizedUrl: `https://example.com/page-${i}`,
      title: `Title ${i} ${i % 2 === 0 ? 'react' : 'vue'}`,
      description: `desc ${i}`,
      tags: i % 3 === 0 ? ['frontend'] : ['misc'],
      snapshotStatus: 'available',
      snapshotType: 'html',
    });
  }
});

describe('performance (SC-003)', () => {
  it('search + sort over 1000 bookmarks returns in under 1s', async () => {
    const start = Date.now();
    const res = await agent
      .get('/api/bookmarks')
      .query({ q: '(react OR vue) #frontend', sort: 'title_asc', pageSize: 25 });
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });
});
