import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadataFromHtml } from '../../src/services/metadata.js';

const BASE = 'https://example.com/article';

test('full metadata extracted', () => {
  const html = `
    <html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="OG Title">
      <meta property="og:description" content="A summary">
      <meta property="og:image" content="/og.png">
      <link rel="icon" href="/fav.ico">
    </head></html>`;
  const m = parseMetadataFromHtml(html, BASE);
  assert.equal(m.title, 'OG Title');
  assert.equal(m.description, 'A summary');
  assert.equal(m.previewImageUrl, 'https://example.com/og.png');
  assert.equal(m.iconUrl, 'https://example.com/fav.ico');
  assert.deepEqual(m.fallbacksUsed, []);
});

test('missing description and image record fallbacks', () => {
  const html = `<html><head><title>Only Title</title></head></html>`;
  const m = parseMetadataFromHtml(html, BASE);
  assert.equal(m.title, 'Only Title');
  assert.equal(m.description, null);
  assert.equal(m.previewImageUrl, null);
  assert.equal(m.iconUrl, 'https://example.com/favicon.ico');
  assert.ok(m.fallbacksUsed.includes('description'));
  assert.ok(m.fallbacksUsed.includes('previewImage'));
  assert.ok(m.fallbacksUsed.includes('icon'));
});

test('no title falls back to derived title', () => {
  const html = `<html><head></head><body>x</body></html>`;
  const m = parseMetadataFromHtml(html, BASE);
  assert.ok(m.fallbacksUsed.includes('title'));
  assert.match(m.title, /example\.com|article/);
});
