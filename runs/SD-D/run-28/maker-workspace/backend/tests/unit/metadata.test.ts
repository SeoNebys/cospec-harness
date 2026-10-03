import { describe, it, expect } from 'vitest';
import { parseMetadata } from '../../src/services/metadata.ts';

const html = `<!doctype html><html><head>
  <title>Fallback Title</title>
  <meta property="og:title" content="OG Title">
  <meta name="description" content="A page description">
  <meta property="og:image" content="/preview.png">
  <link rel="icon" href="/favicon.ico">
</head><body></body></html>`;

describe('parseMetadata', () => {
  it('prefers og:title and resolves relative asset urls', () => {
    const m = parseMetadata(html, 'https://site.test/page');
    expect(m.title).toBe('OG Title');
    expect(m.description).toBe('A page description');
    expect(m.previewImage).toBe('https://site.test/preview.png');
    expect(m.favicon).toBe('https://site.test/favicon.ico');
  });

  it('falls back to <title> and default favicon', () => {
    const m = parseMetadata('<title>Only Title</title>', 'https://site.test/');
    expect(m.title).toBe('Only Title');
    expect(m.description).toBeNull();
    expect(m.favicon).toBe('https://site.test/favicon.ico');
  });
});
