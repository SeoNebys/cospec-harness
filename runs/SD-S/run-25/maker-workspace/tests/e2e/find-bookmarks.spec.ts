import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import type { BookmarkInput, BookmarkList, MetadataPreview } from '../../src/shared/contracts.js';

async function resetLibrary(request: APIRequestContext) {
  const response = await request.get('/api/bookmarks');
  expect(response.ok()).toBeTruthy();
  const list = (await response.json()) as BookmarkList;
  for (const bookmark of list.items) {
    expect((await request.delete(`/api/bookmarks/${bookmark.id}`)).ok()).toBeTruthy();
  }
}

async function seed(request: APIRequestContext, input: BookmarkInput) {
  expect((await request.post('/api/bookmarks', { data: input })).status()).toBe(201);
}

async function installMetadata(page: Page) {
  await page.route('**/api/page-metadata', async (route) => {
    const { url } = route.request().postDataJSON() as { url: string };
    const body: MetadataPreview = {
      requestedUrl: url,
      finalUrl: null,
      outcome: 'unavailable',
      title: null,
      description: null,
      message: 'Page information is unavailable. Enter a title manually.',
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('restores and preserves search, multi-tag filters, and sorting in both views', async ({
  page,
  request,
}) => {
  await resetLibrary(request);
  await seed(request, {
    url: 'https://example.test/alpine',
    title: 'Alpine guide',
    description: 'Mountain reference',
    tags: ['Research', 'Design'],
    readingState: 'to_read',
  });
  await seed(request, {
    url: 'https://example.test/beta',
    title: 'Beta notes',
    tags: ['Research'],
    readingState: 'untracked',
  });
  await seed(request, {
    url: 'https://example.test/design',
    title: 'Design patterns',
    tags: ['Design'],
    readingState: 'to_read',
  });
  await installMetadata(page);

  await page.goto('/?query=guide&tag=research&sort=title');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const search = page.getByRole('searchbox', { name: /search bookmarks/i });
  const research = page.getByRole('checkbox', { name: /research/i });
  const design = page.getByRole('checkbox', { name: /design/i });
  const sort = page.getByRole('combobox', { name: /sort bookmarks/i });
  await expect(search).toHaveValue('guide');
  await expect(research).toBeChecked();
  await expect(sort).toHaveValue('title');
  await expect(page.getByRole('link', { name: 'Alpine guide' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Beta notes' })).toHaveCount(0);

  await design.check();
  await expect(page.getByRole('article')).toHaveCount(1);
  await search.fill('');
  await page.getByRole('button', { name: /remove research filter/i }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await sort.selectOption('title');
  await expect(page.getByRole('article').nth(0)).toContainText('Alpine guide');
  await expect(page.getByRole('article').nth(1)).toContainText('Design patterns');

  await search.fill('guide');
  await page.getByRole('button', { name: /add bookmark/i }).click();
  await page.getByRole('textbox', { name: /web address/i }).fill('https://example.test/new-guide');
  await expect(page.getByText(/page information is unavailable/i)).toBeVisible();
  await page.getByRole('textbox', { name: /^title/i }).fill('Guide additions');
  await page.getByRole('textbox', { name: /^tags/i }).fill('Design');
  await page.getByRole('combobox', { name: /reading status/i }).selectOption('to_read');
  await page.getByRole('button', { name: /save bookmark/i }).click();
  await expect(page.getByRole('link', { name: 'Guide additions' })).toBeVisible();
  await expect(search).toHaveValue('guide');
  await expect(design).toBeChecked();
  await expect(sort).toHaveValue('title');
  await expect(page).toHaveURL(/query=guide/);
  await expect(page).toHaveURL(/tag=design/);
  await expect(page).toHaveURL(/sort=title/);

  await page.getByRole('tab', { name: 'Read Later' }).click();
  await expect(page.getByRole('searchbox', { name: /search bookmarks/i })).toHaveValue('guide');
  await expect(page.getByRole('checkbox', { name: /design/i })).toBeChecked();
  await expect(page.getByRole('combobox', { name: /sort bookmarks/i })).toHaveValue('title');
  await expect(page.getByRole('link', { name: 'Guide additions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Beta notes' })).toHaveCount(0);

  await search.fill('nothing matches this');
  await expect(page.getByRole('heading', { name: /no bookmarks match/i })).toBeVisible();
  await page.getByRole('button', { name: /clear search and filters/i }).click();
  await expect(search).toHaveValue('');
  await expect(design).not.toBeChecked();
  await expect(page.getByRole('link', { name: 'Alpine guide' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Read Later' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('combobox', { name: /sort bookmarks/i })).toHaveValue('title');
});
