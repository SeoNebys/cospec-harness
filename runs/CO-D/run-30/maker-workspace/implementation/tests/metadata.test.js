import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMetadata, isPublicAddress, metadataWithFallback } from '../lib/metadata.js';

test('metadata prefers social page details and resolves the icon', async () => {
  const html = `<!doctype html><html><head>
    <title>Fallback title</title>
    <meta property="og:title" content="A useful article">
    <meta property="og:description" content=" A concise description. ">
    <meta property="og:site_name" content="Example Journal">
    <link rel="icon" href="/brand/icon.png">
  </head></html>`;
  const result = await fetchMetadata('https://example.com/article', {
    publicHostCheck: async () => {},
    fetchImpl: async () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  });
  assert.deepEqual(result, {
    title: 'A useful article',
    description: 'A concise description.',
    siteName: 'Example Journal',
    faviconUrl: 'https://example.com/brand/icon.png',
    fallback: false
  });
});

test('metadata failures return an honest editable site-name fallback', async () => {
  const result = await metadataWithFallback('https://news.example.com/missing', {
    publicHostCheck: async () => {},
    fetchImpl: async () => { throw new Error('offline'); }
  });
  assert.equal(result.title, 'news.example.com');
  assert.equal(result.siteName, 'news.example.com');
  assert.equal(result.description, '');
  assert.equal(result.fallback, true);
});

test('private and loopback addresses are not public fetch targets', () => {
  assert.equal(isPublicAddress('127.0.0.1'), false);
  assert.equal(isPublicAddress('192.168.1.2'), false);
  assert.equal(isPublicAddress('10.0.0.3'), false);
  assert.equal(isPublicAddress('::1'), false);
  assert.equal(isPublicAddress('8.8.8.8'), true);
});

