import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, req } from './helpers.js';

test('empty database returns an empty list', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());
  const { status, body } = await req(app.base, '/api/bookmarks');
  assert.equal(status, 200);
  assert.deepEqual(body.bookmarks, []);
});

test('list is newest-first and includes tag names', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());

  await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://one.example', title: 'One', tags: ['alpha'] }),
  });
  await new Promise((r) => setTimeout(r, 5));
  await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://two.example', title: 'Two', tags: ['beta', 'alpha'] }),
  });

  const { body } = await req(app.base, '/api/bookmarks');
  assert.equal(body.bookmarks.length, 2);
  assert.equal(body.bookmarks[0].title, 'Two'); // newest first
  assert.deepEqual(body.bookmarks[0].tags, ['alpha', 'beta']);
});
