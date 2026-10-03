import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPageMetadata } from '../lib/metadata.js';

test('extracts title, description, source, and decodes common entities', () => {
  const html = `<!doctype html><html><head>
    <title>Fallback title</title>
    <meta content="A useful &amp; detailed description" name="description">
    <meta property="og:title" content="Example &quot;Guide&quot;">
  </head></html>`;
  assert.deepEqual(extractPageMetadata(html, 'https://www.example.com/path'), {
    title: 'Example "Guide"',
    description: 'A useful & detailed description',
    source: 'example.com'
  });
});

test('requires both a recognizable title and description', () => {
  assert.throws(() => extractPageMetadata('<title>Only a title</title>', 'https://example.com'), { code: 'METADATA_UNAVAILABLE' });
});
