import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMetadata } from '../../src/services/metadata.js';

test('extractMetadata prefers OpenGraph tags', () => {
  const html = `
    <html><head>
      <title>Doc Title</title>
      <meta name="description" content="plain desc" />
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG desc" />
      <meta property="og:image" content="/preview.png" />
      <link rel="icon" href="/fav.ico" />
    </head></html>`;
  const m = extractMetadata(html, 'https://example.com/page');
  assert.equal(m.title, 'OG Title');
  assert.equal(m.description, 'OG desc');
  assert.equal(m.previewImage, 'https://example.com/preview.png');
  assert.equal(m.favicon, 'https://example.com/fav.ico');
});

test('extractMetadata falls back to document title, meta description, and default favicon', () => {
  const html = `<html><head><title>Only Title</title>
    <meta name="description" content="only desc" /></head></html>`;
  const m = extractMetadata(html, 'https://example.com/x');
  assert.equal(m.title, 'Only Title');
  assert.equal(m.description, 'only desc');
  assert.equal(m.previewImage, null);
  assert.equal(m.favicon, 'https://example.com/favicon.ico');
});

test('extractMetadata handles empty/missing metadata gracefully', () => {
  const m = extractMetadata('<html><head></head><body></body></html>', 'https://example.com');
  assert.equal(m.title, '');
  assert.equal(m.description, '');
  assert.equal(m.previewImage, null);
  assert.equal(m.favicon, 'https://example.com/favicon.ico');
});
