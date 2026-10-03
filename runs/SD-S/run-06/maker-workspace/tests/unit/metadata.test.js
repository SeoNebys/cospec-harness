import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMetadata, titleFromAddress } from '../../src/metadata.js';

test('extractMetadata reads title, description, and icon', () => {
  const html = `
    <html><head>
      <title>Example Article</title>
      <meta name="description" content="A short summary." />
      <link rel="icon" href="/favicon.png" />
    </head><body></body></html>`;
  const meta = extractMetadata('https://example.com/article', html);
  assert.equal(meta.title, 'Example Article');
  assert.equal(meta.description, 'A short summary.');
  assert.equal(meta.iconUrl, 'https://example.com/favicon.png');
});

test('extractMetadata prefers Open Graph tags when present', () => {
  const html = `
    <html><head>
      <title>Fallback</title>
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG desc" />
    </head></html>`;
  const meta = extractMetadata('https://example.com', html);
  assert.equal(meta.title, 'OG Title');
  assert.equal(meta.description, 'OG desc');
});

test('extractMetadata falls back to /favicon.ico when no icon tag', () => {
  const meta = extractMetadata('https://example.com/x', '<html><head><title>t</title></head></html>');
  assert.equal(meta.iconUrl, 'https://example.com/favicon.ico');
  assert.equal(meta.description, '');
});

test('titleFromAddress derives a readable title (FR-004)', () => {
  assert.equal(titleFromAddress('https://example.com'), 'example.com');
  assert.equal(titleFromAddress('https://example.com/blog/post'), 'example.com/blog/post');
});
