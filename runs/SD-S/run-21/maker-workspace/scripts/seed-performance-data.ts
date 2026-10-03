import { BookmarkRepository } from "../lib/bookmarks/repository";
const repo = new BookmarkRepository();
const count = Number(process.argv[2] || 10000);
for (let i = 0; i < count; i++) {
  if (!repo.duplicate(`https://example.com/seed/${i}`))
    repo.create({
      url: `https://example.com/seed/${i}`,
      normalizedUrl: `https://example.com/seed/${i}`,
      title: `Seed bookmark ${i}`,
      description: `Performance fixture ${i}`,
      tags: [`group-${i % 20}`]
    });
}
console.log(`Seeded ${count} bookmarks.`);
