const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createBookmarkServer } = require('../src/server');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function json(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  return { response, body: response.status === 204 ? null : await response.json() };
}

test('approved bookmark lifecycle persists and protects data integrity', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trove-test-'));
  const dbPath = path.join(tempDir, 'bookmarks.db');

  const pages = http.createServer((request, response) => {
    if (request.url.startsWith('/unavailable')) {
      response.writeHead(503, { 'content-type': 'text/plain' });
      response.end('unavailable');
      return;
    }
    const focus = request.url.startsWith('/focus');
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<html><head><title>${focus ? 'How to focus on meaningful work' : 'Designing for understanding'}</title><meta name="description" content="${focus ? 'Protect attention for deep work.' : 'Make complex interfaces easier to understand.'}"></head></html>`);
  });
  const pagesPort = await listen(pages);

  let app = createBookmarkServer({ dbPath });
  let appPort = await listen(app.server);
  let base = `http://127.0.0.1:${appPort}`;

  t.after(async () => {
    if (app.server.listening) await close(app.server);
    if (pages.listening) await close(pages);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const invalid = await json(base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'plain text' }) });
  assert.equal(invalid.response.status, 422);
  assert.equal(invalid.body.error.code, 'invalid_address');

  const firstUrl = `http://127.0.0.1:${pagesPort}/article`;
  const created = await json(base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: firstUrl }) });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.bookmark.title, 'Designing for understanding');
  assert.equal(created.body.bookmark.description, 'Make complex interfaces easier to understand.');
  assert.equal(created.body.metadataUnavailable, false);

  const exactDuplicate = await json(base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: firstUrl }) });
  assert.equal(exactDuplicate.response.status, 409);
  assert.equal(exactDuplicate.body.error.bookmark.id, created.body.bookmark.id);

  const variedDuplicate = await json(base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: `${firstUrl}/?utm_source=newsletter#examples` })
  });
  assert.equal(variedDuplicate.response.status, 409);

  const fallback = await json(base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: `http://127.0.0.1:${pagesPort}/unavailable` })
  });
  assert.equal(fallback.response.status, 201);
  assert.equal(fallback.body.metadataUnavailable, true);
  assert.match(fallback.body.bookmark.description, /Page details unavailable/);

  const focus = await json(base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: `http://127.0.0.1:${pagesPort}/focus` })
  });
  assert.equal(focus.response.status, 201);

  const uppercaseSearch = await json(base, '/api/bookmarks?query=FOCUS');
  assert.equal(uppercaseSearch.body.bookmarks.length, 1);
  assert.equal(uppercaseSearch.body.bookmarks[0].title, 'How to focus on meaningful work');

  const edited = await json(base, `/api/bookmarks/${created.body.bookmark.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Designing for understanding — reference',
      tags: ['Design', 'design', 'Reference'],
      readLater: true
    })
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.body.bookmark.title, 'Designing for understanding — reference');
  assert.deepEqual(edited.body.bookmark.tags, ['Design', 'Reference']);
  assert.equal(edited.body.bookmark.readLater, true);

  const byTag = await json(base, '/api/bookmarks?tag=design');
  assert.equal(byTag.body.bookmarks.length, 1);
  const readLater = await json(base, '/api/bookmarks?view=later');
  assert.equal(readLater.body.bookmarks.length, 1);

  const conflict = await json(base, `/api/bookmarks/${focus.body.bookmark.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ url: `${firstUrl}#another-section` })
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.bookmark.id, created.body.bookmark.id);

  await close(app.server);
  app = createBookmarkServer({ dbPath });
  appPort = await listen(app.server);
  base = `http://127.0.0.1:${appPort}`;

  const persisted = await json(base, '/api/bookmarks');
  assert.equal(persisted.body.bookmarks.length, 3);
  const persistedEdited = persisted.body.bookmarks.find((bookmark) => bookmark.id === created.body.bookmark.id);
  assert.equal(persistedEdited.readLater, true);
  assert.deepEqual(persistedEdited.tags, ['Design', 'Reference']);

  const markedRead = await json(base, `/api/bookmarks/${created.body.bookmark.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ readLater: false })
  });
  assert.equal(markedRead.body.bookmark.readLater, false);

  assert.equal((await json(base, `/api/bookmarks/${fallback.body.bookmark.id}`, { method: 'DELETE' })).response.status, 204);
  assert.equal((await json(base, `/api/bookmarks/${focus.body.bookmark.id}`, { method: 'DELETE' })).response.status, 204);
  assert.equal((await json(base, `/api/bookmarks/${created.body.bookmark.id}`, { method: 'DELETE' })).response.status, 204);
  assert.equal((await json(base, '/api/bookmarks')).body.bookmarks.length, 0);
});
