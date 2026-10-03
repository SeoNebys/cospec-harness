import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, req } from './helpers.js';

async function seed(base) {
  // Use a stub-free failing enricher indirectly by setting explicit fields.
  await req(base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://alpha.example', title: 'Alpha', note: 'grocery list', tags: ['home'] }),
  });
  await req(base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://beta.example', title: 'Beta', tags: ['work', 'urgent'] }),
  });
}

test('search matches by note', async (t) => {
  const app = await startTestApp({ enrich: async () => ({ ok: false }) });
  t.after(() => app.close());
  await seed(app.base);

  const { body } = await req(app.base, '/api/bookmarks?q=grocery');
  assert.equal(body.bookmarks.length, 1);
  assert.equal(body.bookmarks[0].title, 'Alpha');
});

test('search matches by tag name', async (t) => {
  const app = await startTestApp({ enrich: async () => ({ ok: false }) });
  t.after(() => app.close());
  await seed(app.base);

  const { body } = await req(app.base, '/api/bookmarks?q=urgent');
  assert.equal(body.bookmarks.length, 1);
  assert.equal(body.bookmarks[0].title, 'Beta');
});

test('search matches by url', async (t) => {
  const app = await startTestApp({ enrich: async () => ({ ok: false }) });
  t.after(() => app.close());
  await seed(app.base);

  const { body } = await req(app.base, '/api/bookmarks?q=alpha.example');
  assert.equal(body.bookmarks.length, 1);
});

test('tag filter returns only that tag; combined with q narrows further', async (t) => {
  const app = await startTestApp({ enrich: async () => ({ ok: false }) });
  t.after(() => app.close());
  await seed(app.base);

  const byTag = await req(app.base, '/api/bookmarks?tag=work');
  assert.equal(byTag.body.bookmarks.length, 1);
  assert.equal(byTag.body.bookmarks[0].title, 'Beta');

  const combined = await req(app.base, '/api/bookmarks?tag=work&q=alpha');
  assert.equal(combined.body.bookmarks.length, 0);
});

test('no match returns empty array', async (t) => {
  const app = await startTestApp({ enrich: async () => ({ ok: false }) });
  t.after(() => app.close());
  await seed(app.base);

  const { body } = await req(app.base, '/api/bookmarks?q=zzzznomatch');
  assert.deepEqual(body.bookmarks, []);
});
