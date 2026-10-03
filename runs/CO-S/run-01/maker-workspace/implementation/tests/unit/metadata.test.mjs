import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata, fetchMetadata } from '../../src/metadata.js';

test('parseMetadata prefers og tags, falls back to <title> and meta description', () => {
  const html = `<html><head>
    <title>Fallback Title</title>
    <meta property="og:title" content="OG Title &amp; More" />
    <meta name="description" content="A plain description." />
    <meta property="og:site_name" content="Example Site" />
    </head><body></body></html>`;
  const m = parseMetadata(html, 'https://www.example.com/page');
  assert.equal(m.title, 'OG Title & More');
  assert.equal(m.desc, 'A plain description.');
  assert.equal(m.site, 'Example Site');
});

test('parseMetadata falls back to <title> when no og:title', () => {
  const html = `<html><head><title>  Just   A Title </title></head></html>`;
  const m = parseMetadata(html, 'https://example.com/');
  assert.equal(m.title, 'Just A Title');
  assert.equal(m.desc, '');
});

test('parseMetadata uses host-derived title when no title at all', () => {
  const m = parseMetadata('<html><head></head></html>', 'https://www.serious-eats.com/x');
  assert.equal(m.title, 'Serious-eats');
  assert.equal(m.site, 'Serious-eats');
});

test('fetchMetadata throws on non-ok response (feeds the "couldn\'t get details" path)', async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, text: async () => '' });
  await assert.rejects(() => fetchMetadata('https://example.com', { fetchImpl: fakeFetch }));
});

test('fetchMetadata parses a successful response', async () => {
  const fakeFetch = async () => ({ ok: true, status: 200, text: async () => '<title>Hi</title>' });
  const m = await fetchMetadata('https://example.com', { fetchImpl: fakeFetch });
  assert.equal(m.title, 'Hi');
});
