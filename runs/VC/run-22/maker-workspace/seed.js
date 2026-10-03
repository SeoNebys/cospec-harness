// Seeds a few sample bookmarks if the database is empty.
import db, { createBookmark, listBookmarks } from './db.js';

const samples = [
  { url: 'https://developer.mozilla.org', title: 'MDN Web Docs', description: 'Reference for web standards, HTML, CSS and JavaScript.', tags: 'reference, webdev', favorite: true },
  { url: 'https://news.ycombinator.com', title: 'Hacker News', description: 'Tech and startup news discussion.', tags: 'reading, news' },
  { url: 'https://github.com', title: 'GitHub', description: 'Host and collaborate on code.', tags: 'webdev, tools', favorite: true },
  { url: 'https://www.wikipedia.org', title: 'Wikipedia', description: 'The free encyclopedia.', tags: 'reference' },
  { url: 'https://nodejs.org/en/docs', title: 'Node.js Documentation', description: 'Official Node.js API docs.', tags: 'reference, webdev, tools' },
];

if (listBookmarks().length === 0) {
  for (const s of samples) createBookmark(s);
  console.log(`Seeded ${samples.length} sample bookmarks.`);
} else {
  console.log('Database already has bookmarks; skipping seed.');
}
db.close?.();
