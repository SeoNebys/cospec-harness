// Gherkin-based acceptance tests. Each test maps to the Given/When/Then of an
// approved scenario and drives the real HTTP API with a stubbed title fetcher.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../src/store');
const { createApp } = require('../src/app');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bm-acc-')), 'bookmarks.json');
}

// Start a real server with an injectable, controllable title fetcher.
async function startApp(titleMap) {
  const state = { map: titleMap || {} };
  const titleFetcher = async (url) => state.map[url] || { ok: false };
  const store = new Store(tmpFile());
  const server = http.createServer(createApp(store, { titleFetcher }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  return {
    base,
    state,
    close: () => new Promise((r) => server.close(r)),
    get: (p) => fetch(base + p).then(async (res) => ({ status: res.status, body: await res.json() })),
    send: (method, p, body) =>
      fetch(base + p, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      }).then(async (res) => ({ status: res.status, body: res.status === 204 ? null : await res.json() }))
  };
}

// SCN-001
test('SCN-001: saving a link captures the real page title', async () => {
  const app = await startApp({
    'https://nytimes.com/kyoto': { ok: true, title: 'A 3-Day Guide to Kyoto in Autumn' }
  });
  try {
    // Given the list is empty; When the client saves a link
    const res = await app.send('POST', '/api/bookmarks', { url: 'nytimes.com/kyoto' });
    // Then it is created with the fetched title and appears at the top
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'A 3-Day Guide to Kyoto in Autumn');
    assert.equal(res.body.needsTitle, false);
    assert.equal(res.body.host, 'nytimes.com');
    const list = await app.get('/api/bookmarks');
    assert.equal(list.body[0].id, res.body.id);
  } finally { await app.close(); }
});

// SCN-006 (title-not-found)
test('SCN-006: a link with no fetchable title is still saved and flagged', async () => {
  const app = await startApp({}); // fetcher fails for everything
  try {
    const res = await app.send('POST', '/api/bookmarks', { url: 'blogspot.example/broken' });
    assert.equal(res.status, 201);
    assert.equal(res.body.needsTitle, true);
    assert.equal(res.body.title, 'Blogspot'); // site-name fallback
  } finally { await app.close(); }
});

// SCN-006 (duplicate)
test('SCN-006: saving the same link twice does not create a duplicate', async () => {
  const app = await startApp({ 'https://nytimes.com/kyoto': { ok: true, title: 'Kyoto' } });
  try {
    const first = await app.send('POST', '/api/bookmarks', { url: 'https://nytimes.com/kyoto' });
    const second = await app.send('POST', '/api/bookmarks', { url: 'www.nytimes.com/kyoto/' });
    assert.equal(second.status, 409);
    assert.equal(second.body.error, 'duplicate');
    assert.equal(second.body.existing.id, first.body.id);
    const list = await app.get('/api/bookmarks');
    assert.equal(list.body.length, 1);
  } finally { await app.close(); }
});

// SCN-006 (not a link)
test('SCN-006: pasting a non-link is refused and nothing is saved', async () => {
  const app = await startApp({});
  try {
    const res = await app.send('POST', '/api/bookmarks', { url: 'grocery list' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'not_a_link');
    const list = await app.get('/api/bookmarks');
    assert.equal(list.body.length, 0);
  } finally { await app.close(); }
});

// SCN-006 (add-a-name)
test('SCN-006: the client can give an untitled link a recognizable name', async () => {
  const app = await startApp({});
  try {
    const created = await app.send('POST', '/api/bookmarks', { url: 'x.example/page' });
    assert.equal(created.body.needsTitle, true);
    const named = await app.send('PATCH', '/api/bookmarks/' + created.body.id, { title: 'Tax form 2026' });
    assert.equal(named.body.title, 'Tax form 2026');
    assert.equal(named.body.needsTitle, false);
  } finally { await app.close(); }
});

// SCN-007
test('SCN-007: an offline save keeps the link and fetches the title later', async () => {
  const app = await startApp({}); // start "offline": fetch fails
  try {
    const created = await app.send('POST', '/api/bookmarks', { url: 'https://site.example/post' });
    assert.equal(created.body.needsTitle, true);        // saved anyway
    // Later the connection returns: the fetcher now succeeds.
    app.state.map['https://site.example/post'] = { ok: true, title: 'The Real Title' };
    const refreshed = await app.send('POST', '/api/bookmarks/' + created.body.id + '/refresh-title');
    assert.equal(refreshed.body.title, 'The Real Title');
    assert.equal(refreshed.body.needsTitle, false);
  } finally { await app.close(); }
});

// SCN-004
test('SCN-004: tags added to a link are stored (deduped)', async () => {
  const app = await startApp({ 'https://x.example': { ok: true, title: 'X' } });
  try {
    const created = await app.send('POST', '/api/bookmarks', { url: 'https://x.example' });
    const tagged = await app.send('PATCH', '/api/bookmarks/' + created.body.id, { tags: ['Travel', 'Travel', 'Japan'] });
    assert.deepEqual(tagged.body.tags, ['Travel', 'Japan']);
  } finally { await app.close(); }
});

// SCN-008
test('SCN-008: deleting a link removes it; deleting a missing one 404s', async () => {
  const app = await startApp({ 'https://x.example': { ok: true, title: 'X' } });
  try {
    const created = await app.send('POST', '/api/bookmarks', { url: 'https://x.example' });
    const del = await app.send('DELETE', '/api/bookmarks/' + created.body.id);
    assert.equal(del.status, 204);
    const list = await app.get('/api/bookmarks');
    assert.equal(list.body.length, 0);
    const missing = await app.send('DELETE', '/api/bookmarks/nope');
    assert.equal(missing.status, 404);
  } finally { await app.close(); }
});

// SCN-005
test('SCN-005: a brand-new library returns an empty list', async () => {
  const app = await startApp({});
  try {
    const list = await app.get('/api/bookmarks');
    assert.equal(list.status, 200);
    assert.deepEqual(list.body, []);
  } finally { await app.close(); }
});
