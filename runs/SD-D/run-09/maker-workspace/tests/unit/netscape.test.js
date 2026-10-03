import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNetscape, serializeNetscape } from '../../src/server/services/netscape.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(here, '../fixtures/bookmarks.html'), 'utf8');

describe('netscape import', () => {
  const entries = parseNetscape(fixture);

  it('parses all anchors', () => {
    expect(entries.length).toBe(4);
  });

  it('preserves titles, urls and dates', () => {
    const root = entries.find((e) => e.url === 'https://example.com/root');
    expect(root.title).toBe('Root Bookmark');
    expect(root.dateAdded).toBe(new Date(1600000000 * 1000).toISOString());
  });

  it('maps folders to tags (incl. nested)', () => {
    const p1 = entries.find((e) => e.url === 'https://work.example.com/p1');
    expect(p1.tags).toContain('Work');
    expect(p1.tags).toContain('Projects');
    const x = entries.find((e) => e.url === 'https://read.example.com/x');
    expect(x.tags).toEqual(['Reading']);
    const root = entries.find((e) => e.url === 'https://example.com/root');
    expect(root.tags).toEqual([]);
  });
});

describe('netscape export round-trip', () => {
  it('serialize → parse preserves title, url, date and tags', () => {
    const bookmarks = [
      {
        url: 'https://example.com/a',
        title: 'Alpha',
        tags: ['Work'],
        dateAdded: new Date(1600000000 * 1000).toISOString(),
      },
      {
        url: 'https://example.com/b',
        title: 'Beta & Co <x>',
        tags: [],
        dateAdded: new Date(1610000000 * 1000).toISOString(),
      },
    ];
    const html = serializeNetscape(bookmarks);
    const back = parseNetscape(html);
    const a = back.find((e) => e.url === 'https://example.com/a');
    const b = back.find((e) => e.url === 'https://example.com/b');
    expect(a.title).toBe('Alpha');
    expect(a.tags).toEqual(['Work']);
    expect(a.dateAdded).toBe(bookmarks[0].dateAdded);
    expect(b.title).toBe('Beta & Co <x>');
    expect(b.dateAdded).toBe(bookmarks[1].dateAdded);
  });
});
