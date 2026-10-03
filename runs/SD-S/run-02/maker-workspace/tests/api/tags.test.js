import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, req } from './helpers.js';

test('tags are reused case-insensitively and listed distinctly', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());

  await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://a.example', tags: ['Reading', 'news'] }),
  });
  await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://b.example', tags: ['reading', 'tech'] }),
  });

  const { body } = await req(app.base, '/api/tags');
  // 'Reading' and 'reading' collapse to one tag.
  const readingCount = body.tags.filter((t) => t.toLowerCase() === 'reading').length;
  assert.equal(readingCount, 1);
  assert.deepEqual([...body.tags].sort(), ['Reading', 'news', 'tech'].sort());
});

test('tag prefix filters suggestions', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());

  await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://a.example', tags: ['project-x', 'personal', 'programming'] }),
  });

  const { body } = await req(app.base, '/api/tags?prefix=pro');
  assert.deepEqual([...body.tags].sort(), ['programming', 'project-x'].sort());
});
