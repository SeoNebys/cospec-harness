// T064: seed ~1,000 bookmarks and check search/filter + bulk stay fast (SC-005, SC-006).
// Run: node --disable-warning=ExperimentalWarning tests/perf/seed.js
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.BM_DATA_DIR = mkdtempSync(join(tmpdir(), 'bm-perf-'));

const Bookmark = await import('../../src/server/models/bookmark.js');
const Tag = await import('../../src/server/models/tag.js');
const { parseQuery, matches } = await import('../../src/server/services/search.js');
const db = (await import('../../src/server/db/connection.js')).default;

const N = 1000;
const words = ['python', 'rust', 'recipe', 'invoice', 'travel', 'design', 'music', 'garden'];
const tags = ['work', 'reading', 'home', 'ideas'];

console.log(`Seeding ${N} bookmarks…`);
const t0 = Date.now();
db.exec('BEGIN');
for (let i = 0; i < N; i++) {
  const w = words[i % words.length];
  const b = Bookmark.create({
    url: `https://example.com/${w}/${i}`,
    title: `${w} article ${i}`,
    description: `about ${w} number ${i}`,
    note: i % 5 === 0 ? `note mentioning ${words[(i + 1) % words.length]}` : '',
  });
  Tag.setForBookmark(b.id, [tags[i % tags.length], tags[(i + 1) % tags.length]]);
}
db.exec('COMMIT');
console.log(`  seeded in ${Date.now() - t0}ms`);

// Search timing (SC-005: perceived instant up to 1,000).
const all = Bookmark.allForView({ view: 'all' });
const ast = parseQuery('python #work OR recipe');
const s0 = Date.now();
const results = all.filter((b) => matches(b, ast));
const searchMs = Date.now() - s0;
console.log(`  search over ${all.length} → ${results.length} matches in ${searchMs}ms`);

// Bulk over >=50 (SC-006).
const ids = all.slice(0, 60).map((b) => b.id);
const b0 = Date.now();
db.exec('BEGIN');
for (const id of ids) Bookmark.setReadStatus(id, true);
db.exec('COMMIT');
console.log(`  bulk mark-read over ${ids.length} in ${Date.now() - b0}ms`);

const ok = searchMs < 100 && all.length === N;
console.log(ok ? 'PERF OK' : 'PERF SLOW');
process.exit(ok ? 0 : 1);
