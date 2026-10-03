// Optional: populate the database with a few illustrative sample bookmarks so a
// reviewer sees the features without needing outbound internet for metadata.
// Run: node --disable-warning=ExperimentalWarning scripts/seed-review.js
import * as Bookmark from '../src/server/models/bookmark.js';
import * as Tag from '../src/server/models/tag.js';

const samples = [
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    title: 'JavaScript | MDN',
    description: 'The definitive reference for the JavaScript language.',
    tags: ['reference', 'work'],
    note: 'Bookmark the **Guide** and *Reference* sections.',
  },
  {
    url: 'https://www.gutenberg.org/ebooks/1342',
    title: 'Pride and Prejudice — Project Gutenberg',
    description: 'Jane Austen’s classic novel, free to read.',
    tags: ['reading', 'books'],
    unread: true,
  },
  {
    url: 'https://sqlite.org/fts5.html',
    title: 'SQLite FTS5 Extension',
    description: 'Full-text search module documentation.',
    tags: ['reference', 'databases'],
    note: 'Compare with our custom query parser approach.',
  },
  {
    url: 'https://www.smittenkitchen.com/2019/09/simplest-brothy-beans/',
    title: 'Simplest Brothy Beans — Smitten Kitchen',
    description: 'A cozy weeknight recipe.',
    tags: ['recipes', 'home'],
    unread: true,
  },
  {
    url: 'https://en.wikipedia.org/wiki/Bookmark_(digital)',
    title: 'Bookmark (digital) — Wikipedia',
    description: 'Background on digital bookmarks.',
    tags: ['reference'],
    archived: true,
  },
];

for (const s of samples) {
  const existing = Bookmark.getByUrl(s.url);
  if (existing) continue;
  const b = Bookmark.create({
    url: s.url,
    title: s.title,
    description: s.description,
    note: s.note || '',
  });
  if (s.tags?.length) Tag.setForBookmark(b.id, s.tags);
  if (s.unread === false) Bookmark.setReadStatus(b.id, true);
  if (s.archived) Bookmark.setArchivedStatus(b.id, true);
}

const total = Bookmark.allForView({ view: 'all' }).length;
console.log(`Seeded review data. Active bookmarks: ${total}`);
