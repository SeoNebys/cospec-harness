// Seeds N bookmarks for performance checks (SC-002/003/005).
// Usage: node tests/seed.js [count]
import { migrate } from '../server/db/migrations.js';
import * as Bookmarks from '../server/models/bookmark.js';

migrate();

const count = Number(process.argv[2] || 500);
const words = ['release', 'notes', 'changelog', 'draft', 'guide', 'recipe', 'travel', 'work', 'home', 'news'];
const tagPool = ['work', 'home', 'reading', 'reference', 'recipes', 'travel'];

const t0 = Date.now();
for (let i = 0; i < count; i++) {
  const w1 = words[i % words.length];
  const w2 = words[(i * 7) % words.length];
  Bookmarks.create({
    url: `https://seed.example/${i}`,
    title: `${w1} ${w2} #${i}`,
    description: `A seeded bookmark about ${w1} and ${w2}.`,
    tags: [tagPool[i % tagPool.length], tagPool[(i * 3) % tagPool.length]],
  });
}
console.log(`Seeded ${count} bookmarks in ${Date.now() - t0}ms.`);
