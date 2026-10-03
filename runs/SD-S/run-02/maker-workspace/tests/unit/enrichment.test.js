import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata } from '../../src/enrichment.js';

const BASE = 'https://example.com/page';

test('parses Open Graph metadata and resolves relative image', () => {
  const html = `
    <html><head>
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG Description" />
      <meta property="og:image" content="/images/preview.png" />
      <link rel="icon" href="/favicon.ico" />
      <title>Fallback Title</title>
    </head><body></body></html>`;
  const meta = parseMetadata(html, BASE);
  assert.equal(meta.title, 'OG Title');
  assert.equal(meta.description, 'OG Description');
  assert.equal(meta.previewUrl, 'https://example.com/images/preview.png');
  assert.equal(meta.faviconUrl, 'https://example.com/favicon.ico');
});

test('falls back to <title> and meta description when no OG tags', () => {
  const html = `
    <html><head>
      <title>Plain Title</title>
      <meta name="description" content="Plain description" />
    </head><body></body></html>`;
  const meta = parseMetadata(html, BASE);
  assert.equal(meta.title, 'Plain Title');
  assert.equal(meta.description, 'Plain description');
  assert.equal(meta.previewUrl, undefined);
});

test('defaults favicon to /favicon.ico when no icon link present', () => {
  const html = '<html><head><title>T</title></head><body></body></html>';
  const meta = parseMetadata(html, BASE);
  assert.equal(meta.faviconUrl, 'https://example.com/favicon.ico');
});

test('handles a page with no metadata gracefully', () => {
  const meta = parseMetadata('<html><body>nothing</body></html>', BASE);
  assert.equal(meta.title, undefined);
  assert.equal(meta.description, undefined);
  assert.equal(meta.faviconUrl, 'https://example.com/favicon.ico');
});
