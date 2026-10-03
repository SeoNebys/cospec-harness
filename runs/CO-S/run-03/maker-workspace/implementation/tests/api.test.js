const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createServer, normalizeTags } = require('../server');
const { extractMetadata, fetchPageMetadata, normalizeUrl } = require('../metadata');

async function withApp(run, metadataProvider = async (url) => ({
  title: 'A gathered title', siteName: new URL(url).hostname,
  summary: 'A gathered summary'
})) {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'keep-tests-'));
  const dataFile = path.join(temporaryDirectory, 'bookmarks.json');
  const server = createServer({ dataFile, metadataProvider });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, 'close');
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function api(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json();
  return { response, payload };
}

test('URL and tag normalization support approved validation rules', () => {
  assert.equal(normalizeUrl(' https://Example.com/path '), 'https://example.com/path');
  assert.throws(() => normalizeUrl('not-a-web-address'), /complete web address/);
  assert.deepEqual(normalizeTags('Design, design,  WORK  '), ['design', 'work']);
});

test('HTML page details are extracted and failures return editable fallbacks', async () => {
  const metadata = extractMetadata(`
    <html><head><title>Page &amp; Notes</title>
    <meta name="description" content="A useful summary">
    <meta property="og:site_name" content="Example Journal"></head></html>
  `, 'https://example.com/article');
  assert.deepEqual(metadata, { title: 'Page & Notes', summary: 'A useful summary', siteName: 'Example Journal' });

  const fallback = await fetchPageMetadata('https://smallsite.example/article', {
    fetchImpl: async () => { throw new Error('offline'); }
  });
  assert.equal(fallback.title, 'smallsite.example/article');
  assert.match(fallback.warning, /still saved/);
});

test('saving validates URLs, gathers details, defaults unread, and prevents duplicates', async () => {
  await withApp(async (baseUrl) => {
    const invalid = await api(baseUrl, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'broken-address' }) });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.payload.code, 'INVALID_URL');

    const created = await api(baseUrl, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://example.com/article' }) });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.bookmark.title, 'A gathered title');
    assert.equal(created.payload.bookmark.summary, 'A gathered summary');
    assert.equal(created.payload.bookmark.unread, true);
    assert.equal(created.payload.bookmark.archived, false);

    const duplicate = await api(baseUrl, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://example.com/article' }) });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.payload.code, 'DUPLICATE_URL');

    const list = await api(baseUrl, '/api/bookmarks');
    assert.equal(list.payload.bookmarks.length, 1);
  });
});

test('details, notes, tags, unread status, archive, restore, and deletion persist', async () => {
  await withApp(async (baseUrl) => {
    const created = await api(baseUrl, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://example.com/item' }) });
    const id = created.payload.bookmark.id;

    const blankTitle = await api(baseUrl, `/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ title: '' }) });
    assert.equal(blankTitle.response.status, 400);
    assert.equal(blankTitle.payload.code, 'TITLE_REQUIRED');

    const edited = await api(baseUrl, `/api/bookmarks/${id}`, {
      method: 'PATCH', body: JSON.stringify({ title: 'My useful title', summary: '', note: 'Use this for the redesign kickoff' })
    });
    assert.equal(edited.payload.bookmark.title, 'My useful title');
    assert.equal(edited.payload.bookmark.summary, '');
    assert.equal(edited.payload.bookmark.note, 'Use this for the redesign kickoff');

    const tagged = await api(baseUrl, `/api/bookmarks/${id}/tags`, {
      method: 'POST', body: JSON.stringify({ tags: 'Design, design, WORK' })
    });
    assert.deepEqual(tagged.payload.bookmark.tags, ['design', 'work']);

    const removedTag = await api(baseUrl, `/api/bookmarks/${id}/tags/work`, { method: 'DELETE' });
    assert.deepEqual(removedTag.payload.bookmark.tags, ['design']);

    const read = await api(baseUrl, `/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ unread: false }) });
    assert.equal(read.payload.bookmark.unread, false);
    await api(baseUrl, `/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ unread: true }) });

    const archived = await api(baseUrl, `/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
    assert.equal(archived.payload.bookmark.archived, true);
    assert.equal(archived.payload.bookmark.unread, true);

    const restored = await api(baseUrl, `/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ archived: false }) });
    assert.equal(restored.payload.bookmark.archived, false);
    assert.equal(restored.payload.bookmark.unread, true);

    const removed = await api(baseUrl, `/api/bookmarks/${id}`, { method: 'DELETE' });
    assert.equal(removed.response.status, 200);
    const list = await api(baseUrl, '/api/bookmarks');
    assert.deepEqual(list.payload.bookmarks, []);
  });
});

test('missing metadata still saves a recognizable editable bookmark', async () => {
  await withApp(async (baseUrl) => {
    const saved = await api(baseUrl, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://smallsite.example/article' }) });
    assert.equal(saved.response.status, 201);
    assert.equal(saved.payload.bookmark.title, 'smallsite.example/article');
    assert.ok(saved.payload.warning);
  }, async (url) => ({
    title: new URL(url).hostname + new URL(url).pathname,
    siteName: new URL(url).hostname,
    summary: '', warning: 'Page details were unavailable; the bookmark was still saved.'
  }));
});
