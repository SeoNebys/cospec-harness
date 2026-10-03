// Seed a curated demo dataset directly into the database (no HTTP server
// needed). Safe to run once against a fresh data/ directory. Best-effort
// metadata fetch for favicons/preview images; text is provided inline so the
// result is deterministic even offline.
import db from './db.js';
import { fetchMetadata, saveSnapshot } from './lib/metadata.js';

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'https://' + url;
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  let key = u.href;
  if (u.pathname !== '/' && key.endsWith('/')) key = key.slice(0, -1);
  return { url, key };
}

const SEED = [
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/:has',
    title: 'CSS :has() — MDN',
    description: 'The functional :has() CSS pseudo-class represents an element if any of the relative selectors passed as an argument match at least one element.',
    tags: ['css', 'reference', 'web'],
    favorite: true,
  },
  {
    url: 'https://www.sqlite.org/fts5.html',
    title: 'SQLite FTS5 Extension',
    description: 'FTS5 is an SQLite virtual table module that provides full-text search functionality, including phrase queries and AND/OR/NOT boolean operators.',
    tags: ['sqlite', 'database', 'reference'],
  },
  {
    url: 'https://news.ycombinator.com/',
    title: 'Hacker News',
    description: 'Social news website focusing on computer science and entrepreneurship.',
    tags: ['news', 'tech'],
    read_later: true,
  },
  {
    url: 'https://www.nngroup.com/articles/ten-usability-heuristics/',
    title: '10 Usability Heuristics for User Interface Design',
    description: "Jakob Nielsen's 10 general principles for interaction design — broad rules of thumb, not specific usability guidelines.",
    tags: ['design', 'ux', 'reading'],
    read_later: true,
  },
  {
    url: 'https://12factor.net/',
    title: 'The Twelve-Factor App',
    description: 'A methodology for building software-as-a-service apps that are portable, resilient, and suitable for deployment on modern cloud platforms.',
    tags: ['architecture', 'reference', 'web'],
    favorite: true,
  },
  {
    url: 'https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/',
    title: 'Things You Should Never Do, Part I',
    description: 'Joel Spolsky on why rewriting software from scratch is the single worst strategic mistake a company can make.',
    tags: ['reading', 'tech'],
  },
  {
    url: 'https://web.dev/articles/vitals',
    title: 'Web Vitals',
    description: 'An initiative by Google to provide unified guidance for quality signals that are essential to delivering a great user experience on the web.',
    tags: ['web', 'performance', 'reference'],
  },
  {
    url: 'https://archive.org/',
    title: 'Internet Archive',
    description: 'A non-profit digital library offering free universal access to books, movies, music, and billions of archived web pages.',
    tags: ['reference', 'reading'],
    read_later: true,
  },
];

const VIEWS = [
  { name: 'Reading list', query: '', include_tags: ['reading'], exclude_tags: [], scope: 'active', sort: 'created_desc' },
  { name: 'Reference (no news)', query: '', include_tags: ['reference'], exclude_tags: ['news'], scope: 'active', sort: 'title_asc' },
  { name: 'Favorites', query: '', include_tags: [], exclude_tags: [], scope: 'favorite', sort: 'created_desc' },
];

const insBookmark = db.prepare(
  `INSERT INTO bookmarks (url, url_key, title, description, favicon, preview_image, favorite, read_later)
   VALUES (@url, @url_key, @title, @description, @favicon, @preview_image, @favorite, @read_later)`
);
const insTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
const findTag = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE');
const linkTag = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
const insFts = db.prepare(
  'INSERT INTO bookmarks_fts (rowid, title, description, notes, url, tags) VALUES (?, ?, ?, ?, ?, ?)'
);

async function run() {
  const count = db.prepare('SELECT COUNT(*) c FROM bookmarks').get().c;
  if (count > 0) {
    console.log(`Database already has ${count} bookmarks; skipping seed.`);
    return;
  }

  let snapDone = false;
  for (const s of SEED) {
    const { url, key } = normalizeUrl(s.url);
    let favicon = '';
    let preview_image = '';
    let html = '';
    let finalUrl = url;
    try {
      const meta = await fetchMetadata(url);
      favicon = meta.favicon || '';
      preview_image = meta.preview_image || '';
      html = meta.html || '';
      finalUrl = meta.finalUrl || url;
      process.stdout.write(meta.ok ? '.' : 'x');
    } catch {
      process.stdout.write('x');
    }

    const info = insBookmark.run({
      url,
      url_key: key,
      title: s.title,
      description: s.description,
      favicon,
      preview_image,
      favorite: s.favorite ? 1 : 0,
      read_later: s.read_later ? 1 : 0,
    });
    const id = info.lastInsertRowid;

    for (const name of s.tags) {
      insTag.run(name);
      const t = findTag.get(name);
      if (t) linkTag.run(id, t.id);
    }
    insFts.run(id, s.title, s.description, '', url, s.tags.join(' '));

    // Save one snapshot so the feature is visible in review.
    if (!snapDone && html) {
      try {
        const rel = await saveSnapshot(id, html, finalUrl);
        db.prepare('UPDATE bookmarks SET snapshot_path = ? WHERE id = ?').run(rel, id);
        snapDone = true;
      } catch { /* best-effort */ }
    }
  }

  const insView = db.prepare(
    `INSERT INTO saved_views (name, query, include_tags, exclude_tags, scope, sort)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const v of VIEWS) {
    insView.run(v.name, v.query, JSON.stringify(v.include_tags), JSON.stringify(v.exclude_tags), v.scope, v.sort);
  }

  console.log(`\nSeeded ${SEED.length} bookmarks and ${VIEWS.length} saved views.`);
}

run().then(() => db.close());
