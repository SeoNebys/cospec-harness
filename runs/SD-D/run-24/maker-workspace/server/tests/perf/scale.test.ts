import { describe, it, expect } from 'vitest';
import { freshDb } from '../helpers';
import { create, list } from '../../src/models/bookmarks';

// SC-002: locate a bookmark within a 1,000+ collection quickly.
describe('search performance at scale (SC-002)', () => {
  it('searches a 2,000-bookmark collection well under 1s', () => {
    const db = freshDb();
    const tx = db.transaction(() => {
      for (let i = 0; i < 2000; i++) {
        create({
          url: `https://site${i}.example.com/path/${i}`,
          title: `Bookmark number ${i} about topic ${i % 20}`,
          description: `desc ${i}`,
          tags: [`tag${i % 15}`, `group${i % 5}`],
        });
      }
    });
    tx();

    const s1 = Date.now();
    const r1 = list({ q: 'topic', pageSize: 50 });
    const plainMs = Date.now() - s1;

    const s2 = Date.now();
    const r2 = list({ q: '#tag3 AND topic', pageSize: 50 });
    const boolMs = Date.now() - s2;

    // eslint-disable-next-line no-console
    console.log(`[perf] plain=${r1.total} in ${plainMs}ms; bool+tag=${r2.total} in ${boolMs}ms`);
    expect(r1.total).toBeGreaterThan(0);
    expect(r2.total).toBeGreaterThan(0);
    expect(plainMs).toBeLessThan(1000);
    expect(boolMs).toBeLessThan(1000);
  });
});
