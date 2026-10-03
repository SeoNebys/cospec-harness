'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, canonicalizeUrl, extractMetadata, sanitizeNote } = require('../server');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trove-test-'));
  const app = createApp({ dbPath: path.join(dir, 'test.db') });
  return { ...app, close() { try { app.db.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); } };
}

test('SCN-010 validates web addresses and SCN-014 canonicalizes only safe variations', () => {
  assert.throws(() => canonicalizeUrl('not an address'));
  assert.equal(canonicalizeUrl('https://Example.com/story/?utm_source=newsletter&ref=home'), 'https://example.com/story');
  assert.notEqual(canonicalizeUrl('https://example.com/story?page=1'), canonicalizeUrl('https://example.com/story?page=2'));
});

test('SCN-001 extracts page title and description', () => {
  const details = extractMetadata('<html><head><title>A &amp; B</title><meta name="description" content="Worth keeping"></head></html>');
  assert.deepEqual(details, { title: 'A & B', description: 'Worth keeping' });
});

test('SCN-005 preserves supported note formatting and removes unsafe markup', () => {
  const result = sanitizeNote('<p><strong>Keep</strong></p><ul><li>One</li></ul><a href="https://example.com">safe</a><script>alert(1)</script><a href="javascript:bad()">bad</a>');
  assert.match(result, /<strong>Keep<\/strong>/);
  assert.match(result, /<li>One<\/li>/);
  assert.match(result, /href="https:\/\/example.com"/);
  assert.doesNotMatch(result, /script|javascript:/i);
});

test('SCN-002 stores either corrected page field while preserving the other', () => {
  const fx = fixture();
  const titleChanged = fx.store.create({ url: 'https://title.test', title: 'My replacement title', description: 'Fetched description' }).bookmark;
  const descriptionChanged = fx.store.create({ url: 'https://description.test', title: 'Fetched title', description: 'My replacement description' }).bookmark;
  assert.equal(titleChanged.title, 'My replacement title');
  assert.equal(titleChanged.description, 'Fetched description');
  assert.equal(descriptionChanged.title, 'Fetched title');
  assert.equal(descriptionChanged.description, 'My replacement description');
  fx.close();
});

test('SCN-003, SCN-007, SCN-008 and SCN-016 persist bookmark state without duplicate overwrite', () => {
  const fx = fixture();
  const first = fx.store.create({
    url: 'https://example.com/article', title: 'My title', description: 'My description',
    noteHtml: '<strong>My note</strong>', labels: ['Cooking', 'Ideas'], readLater: true
  }).bookmark;
  const repeated = fx.store.create({ url: 'https://example.com/article/?utm_source=email', title: 'Other title' });
  assert.equal(repeated.duplicate.id, first.id);
  assert.equal(repeated.duplicate.title, 'My title');
  assert.equal(repeated.duplicate.noteHtml, '<strong>My note</strong>');
  assert.deepEqual(repeated.duplicate.labels, ['Cooking', 'Ideas']);
  assert.equal(fx.store.counts().total, 1);
  assert.equal(fx.store.counts().readLater, 1);
  fx.close();
});

test('SCN-004 searches title, description, note and full address newest first', async () => {
  const fx = fixture();
  fx.store.create({ url: 'https://alpha.test/path', title: 'First title', description: 'plain', noteHtml: '<p>weeknight idea</p>' });
  await new Promise(resolve => setTimeout(resolve, 2));
  fx.store.create({ url: 'https://nesslabs.test/calm', title: 'Second title', description: 'focus practice', noteHtml: '' });
  assert.equal(fx.store.list({ search: 'weeknight' })[0].title, 'First title');
  assert.equal(fx.store.list({ search: 'nesslabs' })[0].title, 'Second title');
  assert.equal(fx.store.list({ search: 'focus' })[0].title, 'Second title');
  assert.equal(fx.store.list({ search: 'title' })[0].title, 'Second title');
  assert.equal(fx.store.list({ search: 'volcano' }).length, 0);
  fx.close();
});

test('SCN-006 and SCN-015 reuse labels despite case and whitespace', () => {
  const fx = fixture();
  fx.store.create({ url: 'https://one.test', title: 'One', labels: ['Cooking', 'Ideas'] });
  fx.store.create({ url: 'https://two.test', title: 'Two', labels: [' cooking '] });
  const counts = fx.store.labelCounts();
  assert.equal(counts.find(x => x.name === 'Cooking').count, 2);
  assert.equal(counts.find(x => x.name === 'Ideas').count, 1);
  assert.equal(fx.store.list({ label: 'COOKING' }).length, 2);
  assert.equal(fx.store.list({ label: 'Ideas' })[0].labels.length, 2);
  fx.close();
});

test('SCN-014 keeps uncertain address variations as separate bookmarks', () => {
  const fx = fixture();
  fx.store.create({ url: 'https://example.test/story?page=1', title: 'Page one' });
  fx.store.create({ url: 'https://example.test/story?page=2', title: 'Page two' });
  assert.equal(fx.store.counts().total, 2);
  fx.close();
});

test('SCN-008 marking done removes only Read later membership', () => {
  const fx = fixture();
  const item = fx.store.create({ url: 'https://read.test', title: 'Read me', readLater: true }).bookmark;
  fx.store.update(item.id, { readLater: false });
  assert.equal(fx.store.list({ readLater: true }).length, 0);
  assert.equal(fx.store.list().length, 1);
  fx.close();
});

test('API returns duplicate before fetching and provides manual fallback on fetch failure', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trove-api-'));
  let fetchCalls = 0;
  const fx = createApp({ dbPath: path.join(dir, 'test.db'), fetchImpl: async url => {
    fetchCalls++;
    if (url.includes('unavailable')) throw new Error('offline');
    return new Response('<title>Fetched title</title><meta name="description" content="Fetched description">', { status: 200, headers: { 'content-type': 'text/html' } });
  }});
  await new Promise(resolve => fx.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${fx.server.address().port}`;
  t.after(async () => { await new Promise(resolve => fx.server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); });
  const metadata = await fetch(`${base}/api/metadata`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://good.test/article' }) }).then(r => r.json());
  assert.equal(metadata.title, 'Fetched title');
  await fetch(`${base}/api/bookmarks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: metadata.url, title: metadata.title, description: metadata.description }) });
  const duplicate = await fetch(`${base}/api/metadata`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://good.test/article?ref=email' }) }).then(r => r.json());
  assert.equal(duplicate.duplicate.title, 'Fetched title');
  assert.equal(fetchCalls, 1);
  const fallback = await fetch(`${base}/api/metadata`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://unavailable.test/page' }) }).then(r => r.json());
  assert.equal(fallback.unavailable, true);
});
