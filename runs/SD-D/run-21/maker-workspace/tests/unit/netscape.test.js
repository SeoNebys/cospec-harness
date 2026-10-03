import { describe, it, expect } from 'vitest';
import { parseNetscape, generateNetscape } from '../../server/services/netscape.js';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>Work</H3>
    <DL><p>
        <DT><A HREF="https://example.com/a">Article A</A>
        <DT><H3>Deep</H3>
        <DL><p>
            <DT><A HREF="https://example.com/b">Article B</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://example.com/root">Root Link</A>
</DL><p>`;

describe('netscape import', () => {
  it('parses entries and maps folders to tags', () => {
    const entries = parseNetscape(SAMPLE);
    const a = entries.find((e) => e.url === 'https://example.com/a');
    const b = entries.find((e) => e.url === 'https://example.com/b');
    const root = entries.find((e) => e.url === 'https://example.com/root');
    expect(a.tags).toEqual(['Work']);
    expect(b.tags).toEqual(['Work', 'Deep']);
    expect(root.tags).toEqual([]);
    expect(a.title).toBe('Article A');
  });
});

describe('netscape round-trip', () => {
  it('re-imports generated output preserving url, title, and tags', () => {
    const bookmarks = [
      { url: 'https://example.com/a', title: 'Article A', tags: ['Work'], createdAt: '2026-01-01T00:00:00Z' },
      { url: 'https://example.com/b', title: 'Article B', tags: [], createdAt: '2026-01-02T00:00:00Z' },
    ];
    const html = generateNetscape(bookmarks);
    const parsed = parseNetscape(html);
    const urls = parsed.map((e) => e.url).sort();
    expect(urls).toEqual(['https://example.com/a', 'https://example.com/b']);
    expect(parsed.find((e) => e.url === 'https://example.com/a').title).toBe('Article A');
  });
});
