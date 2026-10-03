'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { extractTitle, extractDescription, decodeEntities, fetchMetadata } = require('../../src/metadata');

test('extractTitle prefers og:title then <title>', () => {
  assert.strictEqual(extractTitle('<title>Plain</title>'), 'Plain');
  assert.strictEqual(
    extractTitle('<meta property="og:title" content="OG Title"><title>Plain</title>'),
    'OG Title'
  );
});

test('extractDescription reads meta description', () => {
  assert.strictEqual(
    extractDescription('<meta name="description" content="A page about things.">'),
    'A page about things.'
  );
});

test('decodeEntities decodes common entities', () => {
  assert.strictEqual(decodeEntities('Tom &amp; Jerry &#39;s'), "Tom & Jerry 's");
});

test('fetchMetadata parses a stubbed HTML response (SCN-001)', async () => {
  const stub = async () => ({
    ok: true,
    headers: { get: () => 'text/html; charset=utf-8' },
    text: async () => '<title>Example Domain</title><meta name="description" content="Docs.">',
  });
  const meta = await fetchMetadata('https://example.com', { fetchImpl: stub });
  assert.strictEqual(meta.title, 'Example Domain');
  assert.strictEqual(meta.description, 'Docs.');
});

test('fetchMetadata throws when the fetch fails (SCN-009)', async () => {
  const stub = async () => { throw new Error('network down'); };
  await assert.rejects(() => fetchMetadata('https://example.com', { fetchImpl: stub }));
});

test('fetchMetadata rejects invalid urls', async () => {
  await assert.rejects(() => fetchMetadata('nope'));
});
