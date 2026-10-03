import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US8: bulk add/remove tags by selection and view-wide', async ({ request }) => {
  const grp = `grp${Date.now()}`;
  const a = await createBookmark(request, { url: uniqueUrl(), title: 'A', tags: [grp] });
  const b = await createBookmark(request, { url: uniqueUrl(), title: 'B', tags: [grp] });

  // Add a tag to a selection.
  let res = await request.post('/api/bookmarks/bulk', {
    data: { target: { ids: [a.id, b.id] }, action: 'addTags', tags: ['bulknew'] },
  });
  expect((await res.json()).affected).toBe(2);
  let list = await (await request.get('/api/bookmarks?includeTags=bulknew')).json();
  expect(list.total).toBe(2);

  // Remove the tag view-wide (filter by the group tag).
  res = await request.post('/api/bookmarks/bulk', {
    data: { target: { filter: { includeTags: [grp] } }, action: 'removeTags', tags: ['bulknew'] },
  });
  expect((await res.json()).affected).toBe(2);
  list = await (await request.get('/api/bookmarks?includeTags=bulknew')).json();
  expect(list.total).toBe(0);
});

test('US8: bulk archive via filter', async ({ request }) => {
  const grp = `arch${Date.now()}`;
  await createBookmark(request, { url: uniqueUrl(), title: 'A', tags: [grp] });
  await createBookmark(request, { url: uniqueUrl(), title: 'B', tags: [grp] });
  await request.post('/api/bookmarks/bulk', {
    data: { target: { filter: { includeTags: [grp] } }, action: 'archive' },
  });
  const active = await (await request.get(`/api/bookmarks?includeTags=${grp}`)).json();
  expect(active.total).toBe(0);
  const archived = await (await request.get(`/api/bookmarks/archived?includeTags=${grp}`)).json();
  expect(archived.total).toBe(2);
});
