// Metadata extraction (SCN-001, SCN-002, SCN-015) with a stubbed fetch.
const test = require('node:test');
const assert = require('node:assert');
const { fetchMetadata } = require('../lib/metadata');

function fakeResponse(html, contentType = 'text/html', bytes = null) {
  return {
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => html,
    arrayBuffer: async () => bytes || Buffer.from(''),
  };
}

test('extracts og title/description/image and favicon', async () => {
  const html = `<html><head>
    <title>Fallback</title>
    <meta property="og:title" content="OG Title">
    <meta property="og:description" content="OG Desc">
    <meta property="og:image" content="/img/preview.png">
    <link rel="icon" href="/favicon-32.png">
  </head><body></body></html>`;
  const m = await fetchMetadata('https://site.example/page', { fetchImpl: async () => fakeResponse(html) });
  assert.strictEqual(m.ok, true);
  assert.strictEqual(m.title, 'OG Title');
  assert.strictEqual(m.desc, 'OG Desc');
  assert.strictEqual(m.image, 'https://site.example/img/preview.png');
  assert.strictEqual(m.favicon, 'https://site.example/favicon-32.png');
  assert.strictEqual(m.isPdf, false);
});

test('falls back to <title> and /favicon.ico', async () => {
  const html = `<html><head><title>Just Title</title></head><body></body></html>`;
  const m = await fetchMetadata('https://www.site.example/x', { fetchImpl: async () => fakeResponse(html) });
  assert.strictEqual(m.title, 'Just Title');
  assert.strictEqual(m.favicon, 'https://www.site.example/favicon.ico');
  assert.strictEqual(m.image, null);
});

test('detects a PDF by content-type', async () => {
  const m = await fetchMetadata('https://site.example/report', { fetchImpl: async () => fakeResponse('', 'application/pdf') });
  assert.strictEqual(m.isPdf, true);
  assert.strictEqual(m.ok, true);
});

test('failed lookup returns ok:false but keeps site/favicon (SCN-002)', async () => {
  const m = await fetchMetadata('https://down.example/x', { fetchImpl: async () => { throw new Error('boom'); } });
  assert.strictEqual(m.ok, false);
  assert.strictEqual(m.site, 'down.example');
  assert.strictEqual(m.favicon, 'https://down.example/favicon.ico');
});
