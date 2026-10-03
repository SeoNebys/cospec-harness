import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata } from '../../src/server/services/metadata.js';

test('parseMetadata extracts og:title, description, icon, preview and resolves URLs', () => {
  const html = `
    <html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="OG Title" />
      <meta name="description" content="A page about testing" />
      <link rel="icon" href="/assets/favicon.png" />
      <meta property="og:image" content="images/preview.jpg" />
    </head><body></body></html>`;
  const meta = parseMetadata(html, 'https://site.example/path/');
  assert.equal(meta.title, 'OG Title');
  assert.equal(meta.description, 'A page about testing');
  assert.equal(meta.icon, 'https://site.example/assets/favicon.png');
  assert.equal(meta.previewImage, 'https://site.example/path/images/preview.jpg');
});

test('parseMetadata falls back to <title> and default favicon', () => {
  const html = '<html><head><title>Just Title</title></head><body></body></html>';
  const meta = parseMetadata(html, 'https://site.example/');
  assert.equal(meta.title, 'Just Title');
  assert.equal(meta.icon, 'https://site.example/favicon.ico');
  assert.equal(meta.description, null);
});
