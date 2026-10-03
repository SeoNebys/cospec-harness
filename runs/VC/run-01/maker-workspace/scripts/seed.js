'use strict';
// Optional: seed a few sample bookmarks so a fresh install shows a populated UI.
// Safe to run once; skips URLs that already exist.
const model = require('../src/model');

const samples = [
  { url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', title: 'JavaScript | MDN Web Docs',
    description: 'The definitive reference for the JavaScript language.', tags: ['dev', 'reference'], favorite: true, unread: false,
    notes: 'Bookmark for the **JS reference**.\n\n- Language guide\n- API docs\n\nAlways up to date.' },
  { url: 'https://news.ycombinator.com', title: 'Hacker News',
    description: 'Startup and technology news, discussion and links.', tags: ['news', 'daily'], unread: true },
  { url: 'https://www.rust-lang.org', title: 'Rust Programming Language',
    description: 'A language empowering everyone to build reliable and efficient software.', tags: ['dev', 'rust'], unread: false },
  { url: 'https://arxiv.org/abs/1706.03762', title: 'Attention Is All You Need',
    description: 'The paper introducing the Transformer architecture.', tags: ['research', 'machine learning'], unread: true,
    notes: 'Read the section on multi-head attention.\n\n> Attention is all you need.' },
  { url: 'https://www.gutenberg.org', title: 'Project Gutenberg',
    description: 'Free eBooks — over 70,000 in the public domain.', tags: ['reading', 'reference'], unread: true },
  { url: 'https://css-tricks.com/snippets/css/a-guide-to-flexbox/', title: 'A Complete Guide to Flexbox',
    description: 'A comprehensive guide to CSS flexbox layout.', tags: ['dev', 'reference', 'css'], favorite: true, unread: false }
];

let n = 0;
for (const s of samples) {
  if (model.findByUrl(s.url)) continue;
  model.createBookmark(s);
  n++;
}
console.log(`Seeded ${n} sample bookmark(s).`);
