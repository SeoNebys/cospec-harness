import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US6: tag suggestions offer existing tags and reuse them', async ({ page, request }) => {
  const tag = `suggestme${Date.now()}`;
  await createBookmark(request, { url: uniqueUrl(), title: 'Has tag', tags: [tag] });
  const target = await createBookmark(request, { url: uniqueUrl(), title: 'Needs tag' });

  page.on('dialog', (d) => d.accept());
  await page.goto(`/#/bookmark/${target.id}`);
  await page.getByLabel('add tag').fill(tag.slice(0, 6));
  await expect(page.getByTestId('tag-suggestions')).toBeVisible();
  await page.getByTestId('tag-suggestions').getByText(`#${tag}`).click();
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes(`/api/bookmarks/${target.id}`) && r.request().method() === 'PATCH'
    ),
    page.getByRole('button', { name: 'Save changes' }).click(),
  ]);

  // The existing tag is reused (no near-duplicate created).
  const tags = await (await request.get(`/api/tags?prefix=${tag}`)).json();
  expect(tags.filter((t) => t.name === tag).length).toBe(1);
  expect(tags.find((t) => t.name === tag).count).toBe(2);
});

test('US6: include-tag filter narrows the list', async ({ request }) => {
  const tag = `filt${Date.now()}`;
  await createBookmark(request, { url: uniqueUrl(), title: 'In', tags: [tag] });
  await createBookmark(request, { url: uniqueUrl(), title: 'Out' });
  const list = await (await request.get(`/api/bookmarks?includeTags=${tag}`)).json();
  expect(list.total).toBe(1);
});
