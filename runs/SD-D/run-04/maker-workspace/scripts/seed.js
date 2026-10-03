// Seed a large collection for performance validation (SC-002/003/008).
// Usage: node scripts/seed.js [count]
import { getDb } from '../src/db/index.js';
import { createBookmark } from '../src/models/bookmark.js';

const count = parseInt(process.argv[2], 10) || 5000;
const db = getDb();
const tags = ['news', 'tech', 'recipe', 'cooking', 'reading', 'reference', 'video'];

console.log(`Seeding ${count} bookmarks…`);
const start = Date.now();
const txn = db.transaction(() => {
  for (let i = 0; i < count; i++) {
    const t = [tags[i % tags.length]];
    if (i % 3 === 0) t.push('reading');
    createBookmark(
      {
        url: `https://example.com/item/${i}`,
        title: `Bookmark number ${i}`,
        description: `Description for item ${i}`,
        tags: t,
      },
      db
    );
  }
});
txn();
console.log(`Seeded ${count} in ${Date.now() - start}ms`);
