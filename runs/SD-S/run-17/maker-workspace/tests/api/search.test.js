import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, req } from './helper.js';

let ctx;
before(async () => {
  ctx = await startServer();
  await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/news', title: 'Daily News', tags: ['news'], notes: 'headlines' }),
  });
  await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/code', title: 'Code Docs', tags: ['dev'], notes: 'reference' }),
  });
});
after(async () => {
  await ctx.stop();
});

test('search matches title (FR-011)', async () => {
  const { body } = await req(ctx.base, '/api/bookmarks?q=daily');
  assert.equal(body.total, 2);
  assert.equal(body.matched, 1);
  assert.equal(body.bookmarks[0].title, 'Daily News');
});

test('search matches notes and tags (FR-011)', async () => {
  const byNotes = await req(ctx.base, '/api/bookmarks?q=reference');
  assert.equal(byNotes.body.matched, 1);
  assert.equal(byNotes.body.bookmarks[0].title, 'Code Docs');

  const byTag = await req(ctx.base, '/api/bookmarks?q=news');
  assert.equal(byTag.body.matched, 1);
});

test('tag filter restricts to tagged bookmarks (FR-012)', async () => {
  const { body } = await req(ctx.base, '/api/bookmarks?tag=dev');
  assert.equal(body.matched, 1);
  assert.equal(body.bookmarks[0].title, 'Code Docs');
});

test('non-matching filter yields matched 0 with total > 0 (FR-013)', async () => {
  const { body } = await req(ctx.base, '/api/bookmarks?q=zzzznope');
  assert.ok(body.total > 0);
  assert.equal(body.matched, 0);
});
