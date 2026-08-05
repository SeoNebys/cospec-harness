/**
 * Seed the database with many bookmarks for SC-005 responsiveness spot checks.
 * Usage: DB_PATH=data/bookmarks.db npm run seed -- [count]
 */
import { openDb } from "../src/db/index.js";
import { config } from "../src/config.js";
import { createBookmarkService } from "../src/services/bookmarks.js";

const count = Number(process.argv[2] ?? 2000);
const db = openDb(config.dbPath);
const service = createBookmarkService({
  db,
  undoWindowMs: config.undoWindowMs,
  // No network during seeding: title falls back to the URL unless we set one.
  deriveTitle: async () => null,
});

const sampleTags = ["tech", "reading", "news", "reference", "fun", "work"];

let created = 0;
for (let i = 0; i < count; i++) {
  const tags = [sampleTags[i % sampleTags.length], sampleTags[(i * 7) % sampleTags.length]];
  try {
    await service.create({
      url: `https://example.com/article/${i}`,
      title: `Sample bookmark #${i}`,
      tags,
    });
    created++;
  } catch {
    // ignore duplicates on re-run
  }
}

console.log(`Seeded ${created} bookmarks into ${config.dbPath}`);
