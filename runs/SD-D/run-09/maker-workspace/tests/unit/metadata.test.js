import { describe, it, expect } from 'vitest';
import { parseMetadata, collectMetadata } from '../../src/server/services/metadata.js';

const HTML = `
<html><head>
  <title>Fallback Title</title>
  <meta property="og:title" content="OG Title">
  <meta name="description" content="Meta description">
  <meta property="og:image" content="/preview.png">
  <link rel="icon" href="/assets/favicon.ico">
</head><body>Hi</body></html>`;

describe('parseMetadata', () => {
  it('prefers og:title and resolves relative asset URLs to absolute', () => {
    const m = parseMetadata(HTML, 'https://example.com/page');
    expect(m.title).toBe('OG Title');
    expect(m.description).toBe('Meta description');
    expect(m.previewImagePath).toBe('https://example.com/preview.png');
    expect(m.faviconPath).toBe('https://example.com/assets/favicon.ico');
    expect(m.metadataStatus).toBe('collected');
  });

  it('falls back to /favicon.ico when no icon link present', () => {
    const m = parseMetadata('<html><head><title>T</title></head></html>', 'https://x.example/a');
    expect(m.faviconPath).toBe('https://x.example/favicon.ico');
    expect(m.title).toBe('T');
  });
});

describe('collectMetadata', () => {
  it('returns fallback when the fetch fails/times out', async () => {
    const failing = async () => {
      throw new Error('network down');
    };
    const m = await collectMetadata('https://unreachable.example', { fetchImpl: failing });
    expect(m.metadataStatus).toBe('fallback');
    expect(m.title).toBe('unreachable.example');
    expect(m.description).toBe('');
  });

  it('collects from a successful HTML response', async () => {
    const okFetch = async () => ({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => HTML,
    });
    const m = await collectMetadata('https://example.com/page', { fetchImpl: okFetch });
    expect(m.metadataStatus).toBe('collected');
    expect(m.title).toBe('OG Title');
  });
});
