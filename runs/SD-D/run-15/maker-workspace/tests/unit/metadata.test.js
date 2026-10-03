// T015 [US1]: unit tests for metadata parsing + fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata } from '../../src/server/services/metadata.js';

test('parses OpenGraph title/description/image and icon', () => {
  const html = `
    <html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="An OG description." />
      <meta property="og:image" content="/preview.png" />
      <link rel="icon" href="/icon.png" />
    </head><body></body></html>`;
  const meta = parseMetadata(html, 'https://example.com/page');
  assert.equal(meta.title, 'OG Title');
  assert.equal(meta.description, 'An OG description.');
  assert.equal(meta.preview_image, 'https://example.com/preview.png');
  assert.equal(meta.icon_url, 'https://example.com/icon.png');
});

test('falls back to <title> and meta description when no OG tags', () => {
  const html = `
    <html><head>
      <title>Plain Title</title>
      <meta name="description" content="Plain description." />
    </head><body></body></html>`;
  const meta = parseMetadata(html, 'https://example.org/');
  assert.equal(meta.title, 'Plain Title');
  assert.equal(meta.description, 'Plain description.');
  // default favicon location resolved against the base URL
  assert.equal(meta.icon_url, 'https://example.org/favicon.ico');
});

test('returns empty fields for malformed/empty input without throwing', () => {
  const meta = parseMetadata('', 'https://example.net/');
  assert.equal(meta.title, '');
  assert.equal(meta.description, '');
  assert.equal(meta.preview_image, '');
  // icon still resolves to the default favicon path
  assert.equal(meta.icon_url, 'https://example.net/favicon.ico');
});
