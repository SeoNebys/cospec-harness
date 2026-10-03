import { describe, it, expect } from 'vitest';
import { extractMetadata } from '../../server/services/metadata.js';

describe('metadata extraction', () => {
  it('reads Open Graph tags, description, and preview', () => {
    const html = `<html><head>
      <meta property="og:title" content="OG Title" />
      <meta name="description" content="A description." />
      <meta property="og:image" content="/preview.png" />
      <link rel="icon" href="/fav.ico" />
      <title>Fallback Title</title>
    </head></html>`;
    const m = extractMetadata(html, 'https://example.com/page');
    expect(m.title).toBe('OG Title');
    expect(m.description).toBe('A description.');
    expect(m.previewImageUrl).toBe('https://example.com/preview.png');
    expect(m.iconUrl).toBe('https://example.com/fav.ico');
  });

  it('falls back to <title> and default favicon', () => {
    const m = extractMetadata('<html><head><title>Only Title</title></head></html>', 'https://example.com/');
    expect(m.title).toBe('Only Title');
    expect(m.iconUrl).toBe('https://example.com/favicon.ico');
  });

  it('returns nulls when nothing is present', () => {
    const m = extractMetadata('<html></html>', 'https://example.com/');
    expect(m.title).toBeNull();
    expect(m.description).toBeNull();
    expect(m.previewImageUrl).toBeNull();
  });
});
