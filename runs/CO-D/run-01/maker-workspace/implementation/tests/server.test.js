import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp, normalizeUrl, cleanNote } from '../server.js';

test('normalizes ordinary URL differences without changing meaningful queries', () => {
  assert.equal(normalizeUrl('HTTPS://Example.COM:443/article/#part'), 'https://example.com/article');
  assert.equal(normalizeUrl('https://example.com/article?edition=2'), 'https://example.com/article?edition=2');
  assert.throws(() => normalizeUrl('not a url'));
});

test('sanitizes notes while preserving approved formatting', () => {
  const result = cleanNote('<p><strong>Keep</strong><script>alert(1)</script><a href="javascript:bad()">bad</a><a href="https://example.com">good</a></p>');
  assert.match(result, /<strong>Keep<\/strong>/);
  assert.doesNotMatch(result, /script|javascript/);
  assert.match(result, /noopener noreferrer/);
});

test('API saves, rejects duplicates, edits statuses, and deletes', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'keep-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const metadataFetcher = async url => ({ url: normalizeUrl(url), title: 'Found title', description: 'Found description', siteName: 'example.com', icon: '', image: '', fetched: true });
  const server = createApp({ dataFile: path.join(directory, 'data.json'), metadataFetcher }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, options = {}) => fetch(base + route, { ...options, headers: { 'content-type': 'application/json' } });
  let response = await request('/api/preview', { method: 'POST', body: JSON.stringify({ url: 'https://example.com/story/' }) });
  assert.equal(response.status, 200); const preview = await response.json();
  response = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ ...preview, title: 'My title', labels: ['Research'], note: '<b>Mine</b>' }) });
  assert.equal(response.status, 201); const saved = await response.json();
  response = await request('/api/preview', { method: 'POST', body: JSON.stringify({ url: 'https://EXAMPLE.com/story#top' }) });
  assert.equal(response.status, 409);
  response = await request(`/api/bookmarks/${saved.id}`, { method: 'PATCH', body: JSON.stringify({ readLater: true, archived: true, labels: ['Research', 'research'] }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).readLater, true);
  response = await request(`/api/bookmarks/${saved.id}`, { method: 'DELETE' }); assert.equal(response.status, 204);
  response = await request('/api/bookmarks'); assert.equal((await response.json()).bookmarks.length, 0);
});
