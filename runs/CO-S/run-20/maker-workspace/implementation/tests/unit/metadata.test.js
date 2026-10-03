import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata, fetchMetadata, hostOf } from '../../src/metadata.js';

test('parseMetadata prefers og tags, resolves favicon (SCN-001)', () => {
  const html = `
    <html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="Great Article" />
      <meta property="og:description" content="A very good read" />
      <link rel="icon" href="/assets/fav.png" />
    </head></html>`;
  const meta = parseMetadata(html, 'https://example.com/post');
  assert.equal(meta.title, 'Great Article');
  assert.equal(meta.description, 'A very good read');
  assert.equal(meta.favicon, 'https://example.com/assets/fav.png');
});

test('parseMetadata falls back to <title> and meta description', () => {
  const html = `<title>Plain Title</title><meta name="description" content="Plain desc">`;
  const meta = parseMetadata(html, 'https://plain.test/a');
  assert.equal(meta.title, 'Plain Title');
  assert.equal(meta.description, 'Plain desc');
  assert.equal(meta.favicon, 'https://plain.test/favicon.ico');
});

test('parseMetadata decodes HTML entities', () => {
  const html = `<title>Tips &amp; Tricks &#39;24</title>`;
  const meta = parseMetadata(html, 'https://x.com');
  assert.equal(meta.title, "Tips & Tricks '24");
});

test('parseMetadata uses host as title when none present', () => {
  const meta = parseMetadata('<html></html>', 'https://www.news.example.com/story');
  assert.equal(meta.title, 'news.example.com');
});

test('hostOf strips www', () => {
  assert.equal(hostOf('https://www.abc.com/x'), 'abc.com');
  assert.equal(hostOf('not a url'), '');
});

test('fetchMetadata returns ok:false on invalid URL (SCN-006)', async () => {
  assert.deepEqual(await fetchMetadata('not a url'), { ok: false });
});

test('fetchMetadata returns ok:false for non-http protocols', async () => {
  assert.deepEqual(await fetchMetadata('ftp://x.com/a'), { ok: false });
});

test('fetchMetadata returns ok:false when the request fails (SCN-006)', async () => {
  const failing = async () => { throw new Error('network down'); };
  assert.deepEqual(await fetchMetadata('https://x.com', { fetchImpl: failing }), { ok: false });
});

test('fetchMetadata returns ok:false on non-2xx response', async () => {
  const notOk = async () => ({ ok: false, status: 500, url: 'https://x.com', text: async () => '' });
  assert.deepEqual(await fetchMetadata('https://x.com', { fetchImpl: notOk }), { ok: false });
});

test('fetchMetadata parses a successful response', async () => {
  const okFetch = async (url) => ({
    ok: true, status: 200, url,
    text: async () => '<title>Hi</title><meta name="description" content="d">',
  });
  const meta = await fetchMetadata('https://good.test/p', { fetchImpl: okFetch });
  assert.equal(meta.ok, true);
  assert.equal(meta.title, 'Hi');
  assert.equal(meta.description, 'd');
});
