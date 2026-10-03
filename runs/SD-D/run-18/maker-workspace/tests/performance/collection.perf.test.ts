import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type DB } from '../../packages/persistence/src/database.js';
import { migrate } from '../../packages/persistence/src/migrate.js';
import { Store } from '../../packages/persistence/src/store.js';
import { parseBookmarksHtml } from '../../packages/bookmark-html/src/import.js';
import { exportBookmarksHtml } from '../../packages/bookmark-html/src/export.js';
let dir: string, db: DB, store: Store;
const ids: string[] = [];
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepsake-perf-'));
  db = openDatabase(path.join(dir, 'db.sqlite'));
  migrate(db);
  store = new Store(db);
  const insert = db.prepare(
      "INSERT INTO bookmarks(id,url,normalized_url,title,description,note_text,read_status,copy_status,created_at,updated_at) VALUES(?,?,?,?,?,'','unread','failed',?,?)",
    ),
    fts = db.prepare(
      "INSERT INTO bookmark_fts(bookmark_id,title,url,description,note_text,tags) VALUES(?,?,?,?,?,'')",
    ),
    stamp = new Date().toISOString();
  db.transaction(() => {
    for (let i = 0; i < 10000; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        url = `https://example.com/${i}`,
        title = i === 6789 ? 'Needle field guide' : `Reference ${i}`;
      insert.run(id, url, url, title, `Description ${i}`, stamp, stamp);
      fts.run(id, title, url, `Description ${i}`, '');
      ids.push(id);
    }
  })();
});
afterAll(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
describe('approved scale targets', () => {
  it('finds a known item among 10,000 within one second', () => {
    const start = performance.now(),
      result = store.list({ q: 'needle', pageSize: 30 });
    expect(result.total).toBe(1);
    expect(performance.now() - start).toBeLessThan(1000);
  });
  it('bulk-updates 500 bookmarks within five seconds', () => {
    const start = performance.now(),
      result = store.bulk(ids.slice(0, 500), 'read');
    expect(result.succeeded).toBe(500);
    expect(performance.now() - start).toBeLessThan(5000);
  });
  it('retains 10,000 titles and addresses through browser-format interchange', () => {
    const source = Array.from(
      { length: 10000 },
      (_, index) =>
        `<DT><A HREF="https://portable.example/${index}">Portable ${index}</A>`,
    ).join('\n');
    const parsed = parseBookmarksHtml(`<DL>${source}</DL>`);
    expect(parsed.items).toHaveLength(10000);
    const exported = exportBookmarksHtml(
      parsed.items.map((item) => ({ ...item, createdAt: '2024-01-01T00:00:00Z' })),
    );
    const roundTrip = parseBookmarksHtml(exported);
    expect(roundTrip.items).toHaveLength(10000);
    expect(roundTrip.items[9999]).toMatchObject({
      url: 'https://portable.example/9999',
      title: 'Portable 9999',
    });
  });
});
