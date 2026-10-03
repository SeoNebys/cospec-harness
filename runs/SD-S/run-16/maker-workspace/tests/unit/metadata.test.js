import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata, titleFromUrl } from '../../src/services/metadata.js';

test('titleFromUrl derives host + path', () => {
  assert.equal(titleFromUrl('https://example.com/foo/bar'), 'example.com/foo/bar');
  assert.equal(titleFromUrl('https://example.com/'), 'example.com');
});

test('prefers Open Graph tags', () => {
  const html = `
    <html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG Description" />
      <meta property="og:image" content="/og.png" />
      <link rel="icon" href="/fav.ico" />
    </head></html>`;
  const m = parseMetadata(html, 'https://example.com/page');
  assert.equal(m.title, 'OG Title');
  assert.equal(m.description, 'OG Description');
  assert.equal(m.previewImageUrl, 'https://example.com/og.png');
  assert.equal(m.faviconUrl, 'https://example.com/fav.ico');
});

test('falls back to <title> and meta description', () => {
  const html = `
    <html><head>
      <title>Just A Title</title>
      <meta name="description" content="Plain description" />
    </head></html>`;
  const m = parseMetadata(html, 'https://example.com/');
  assert.equal(m.title, 'Just A Title');
  assert.equal(m.description, 'Plain description');
  assert.equal(m.previewImageUrl, null);
  // Default favicon path when no <link rel=icon>.
  assert.equal(m.faviconUrl, 'https://example.com/favicon.ico');
});

test('falls back to twitter:image for preview', () => {
  const html = `<html><head>
    <meta name="twitter:image" content="https://cdn.example.com/t.jpg" />
  </head></html>`;
  const m = parseMetadata(html, 'https://example.com/');
  assert.equal(m.previewImageUrl, 'https://cdn.example.com/t.jpg');
});

test('URL-derived title when no title present', () => {
  const m = parseMetadata('<html><head></head></html>', 'https://example.com/x');
  assert.equal(m.title, 'example.com/x');
});
