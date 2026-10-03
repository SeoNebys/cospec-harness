// Loads a small, realistic sample set so the app demonstrates its features
// on first view. Safe to run once against a fresh database.
import { migrate } from '../server/db/migrations.js';
import * as Bookmarks from '../server/models/bookmark.js';
import db from '../server/db/connection.js';

migrate();

const existing = db.prepare('SELECT COUNT(*) AS n FROM bookmark').get().n;
if (existing > 0) {
  console.log(`Database already has ${existing} bookmarks; leaving as-is.`);
  process.exit(0);
}

const samples = [
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    title: 'JavaScript | MDN',
    description: 'The definitive JavaScript reference documentation.',
    tags: ['reference', 'work'],
    noteHtml: '<p><strong>Bookmark</strong> the array methods section.</p>',
  },
  {
    url: 'https://www.nasa.gov/news/',
    title: 'NASA News & Features',
    description: 'Latest news, images, and discoveries from NASA.',
    tags: ['reading', 'science'],
  },
  {
    url: 'https://www.seriouseats.com/recipes',
    title: 'Serious Eats Recipes',
    description: 'Tested recipes with the science behind them.',
    tags: ['recipes', 'home'],
  },
  {
    url: 'https://news.ycombinator.com/',
    title: 'Hacker News',
    description: 'Tech and startup news and discussion.',
    tags: ['reading', 'work'],
  },
  {
    url: 'https://www.gutenberg.org/ebooks/1342',
    title: 'Pride and Prejudice by Jane Austen',
    description: 'Free ebook from Project Gutenberg.',
    tags: ['reading'],
  },
  {
    url: 'https://web.dev/learn/',
    title: 'Learn web development — web.dev',
    description: 'Structured courses on modern web development.',
    tags: ['reference', 'work'],
  },
];

let created = [];
for (const s of samples) created.push(Bookmarks.create(s));

// Show off the two independent axes: mark two as read, archive one (still unread).
Bookmarks.update(created[0].id, { isRead: true }); // MDN read
Bookmarks.update(created[3].id, { isRead: true }); // HN read
Bookmarks.update(created[4].id, { isArchived: true }); // Pride & Prejudice archived, still unread

console.log(`Loaded ${created.length} sample bookmarks.`);
