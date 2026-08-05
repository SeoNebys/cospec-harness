import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseMetadata, fetchMetadata } from '../../src/server/services/metadata';

const OG_HTML = `
<html><head>
  <title>Fallback Title</title>
  <meta property="og:title" content="Great Recipes &amp; More" />
  <meta property="og:description" content="A page about dinner." />
  <meta property="og:image" content="/preview.png" />
  <link rel="icon" href="/favicon.ico" />
</head><body>...</body></html>`;

const BARE_HTML = `<html><head><title>Just A Title</title></head><body></body></html>`;

const PARTIAL_HTML = `
<html><head>
  <meta name="description" content="Only a description." />
  <link rel="shortcut icon" href="https://cdn.example.com/i.png" />
</head><body></body></html>`;

describe('parseMetadata (FR-005, research §3)', () => {
  it('prefers Open Graph and resolves relative URLs against the base', () => {
    const m = parseMetadata(OG_HTML, 'https://site.example/page');
    expect(m.title).toBe('Great Recipes & More');
    expect(m.description).toBe('A page about dinner.');
    expect(m.imageUrl).toBe('https://site.example/preview.png');
    expect(m.iconUrl).toBe('https://site.example/favicon.ico');
  });

  it('falls back to <title> when no OG title exists', () => {
    const m = parseMetadata(BARE_HTML, 'https://site.example/');
    expect(m.title).toBe('Just A Title');
    expect(m.description).toBeUndefined();
    // No <link icon>; defaults to /favicon.ico on the site.
    expect(m.iconUrl).toBe('https://site.example/favicon.ico');
  });

  it('handles partial data (description + absolute icon, no image)', () => {
    const m = parseMetadata(PARTIAL_HTML, 'https://site.example/x');
    expect(m.title).toBeUndefined();
    expect(m.description).toBe('Only a description.');
    expect(m.iconUrl).toBe('https://cdn.example.com/i.png');
    expect(m.imageUrl).toBeNull();
  });
});

describe('fetchMetadata safety (research §3, FR-005)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns empty metadata (never throws) when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchMetadata('https://unreachable.example/')).resolves.toEqual({});
  });

  it('ignores non-HTML responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/pdf']]),
        body: null,
        text: async () => 'not html',
      } as unknown as Response)
    );
    await expect(fetchMetadata('https://example.com/file.pdf')).resolves.toEqual({});
  });

  it('returns empty on an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, headers: new Map() } as unknown as Response)
    );
    await expect(fetchMetadata('https://example.com/')).resolves.toEqual({});
  });
});
