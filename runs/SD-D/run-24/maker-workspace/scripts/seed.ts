// Offline demo seed: inserts a few bookmarks (no network/enrichment) so the
// review shows populated All / Read Later / Archive views. Run: tsx scripts/seed.ts
import { getDb } from '../server/src/db/connection';
import { migrate } from '../server/src/db/migrate';
import { create, update } from '../server/src/models/bookmarks';
import { upsertCopy } from '../server/src/models/preservedCopies';

migrate(getDb());

const samples = [
  {
    url: 'https://www.typescriptlang.org/docs/',
    title: 'TypeScript Documentation',
    description: 'The handbook and reference for the TypeScript language.',
    tags: ['reference', 'typescript', 'dev'],
    note: '## Why kept\nGreat for looking up **utility types** and config options.',
  },
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
    title: 'HTTP — MDN Web Docs',
    description: 'An overview of HTTP, methods, status codes, and headers.',
    tags: ['reference', 'web'],
    note: '',
  },
  {
    url: 'https://sqlite.org/fts5.html',
    title: 'SQLite FTS5 Extension',
    description: 'Full-text search module for SQLite.',
    tags: ['dev', 'database'],
    note: '',
  },
  {
    url: 'https://react.dev/learn',
    title: 'Quick Start – React',
    description: 'Learn React with the modern docs.',
    tags: ['reading', 'react', 'dev'],
    note: 'Read the **effects** section next.',
    readLater: true,
  },
  {
    url: 'https://www.nngroup.com/articles/',
    title: 'Nielsen Norman Group — UX Articles',
    description: 'Research-based UX guidance.',
    tags: ['reading', 'design'],
    note: '',
    readLater: true,
  },
  {
    url: 'https://old.example.org/legacy-post',
    title: 'An older reference (archived)',
    description: 'Kept for history, out of the main list.',
    tags: ['archive'],
    note: '',
    archived: true,
  },
];

for (const s of samples) {
  const { bookmark, duplicate } = create({
    url: s.url,
    title: s.title,
    description: s.description,
    tags: s.tags,
    note_markdown: s.note,
  });
  if (!duplicate) {
    const patch: Record<string, unknown> = {};
    if (s.readLater) patch.read = false;
    if (s.archived) patch.archived = true;
    if (Object.keys(patch).length) update(bookmark.id, patch);
    // Offline seed: no page was captured, so mark the local copy unavailable
    // rather than leaving it "pending" (which implies an in-progress capture).
    upsertCopy(bookmark.id, { status: 'unavailable' });
  }
}

// eslint-disable-next-line no-console
console.log('Seeded demo bookmarks.');
