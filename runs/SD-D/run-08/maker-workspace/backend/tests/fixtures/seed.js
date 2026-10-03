// Seed the database with N bookmarks for performance validation (SC-003/SC-004).
// Usage: BOOKMARKS_DATA_DIR=./data-perf node tests/fixtures/seed.js 5000
import { create } from '../../src/models/bookmarks.js';
import { normalizeUrl } from '../../src/url/normalize.js';

const N = Number(process.argv[2] || 5000);
const WORDS = ['report', 'design', 'recipe', 'travel', 'finance', 'health', 'coding', 'music', 'garden', 'science'];
const TAGS = ['work', 'personal', 'reading', 'reference', 'archive-me', 'fun', 'urgent'];

const start = Date.now();
for (let i = 0; i < N; i += 1) {
  const url = `https://seed.example.com/item-${i}`;
  const w = WORDS[i % WORDS.length];
  create({
    url,
    urlKey: normalizeUrl(url),
    title: `${w} article number ${i}`,
    description: `A ${w} resource about topic ${i % 50}`,
    note: i % 3 === 0 ? `Note about ${w}` : null,
    tags: [TAGS[i % TAGS.length], TAGS[(i + 3) % TAGS.length]],
  });
}
console.log(`Seeded ${N} bookmarks in ${Date.now() - start}ms`);
