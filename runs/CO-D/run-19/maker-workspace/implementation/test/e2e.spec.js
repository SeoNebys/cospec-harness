import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request, page }) => {
  await request.post('/api/test/reset');
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
});

test('SCN-001, SCN-002, SCN-010, SCN-011 saving, editing, opening, and fallback behavior', async ({ page }) => {
  await expect(page.locator('#all-count')).toHaveText('4');
  await page.locator('#url-input').fill('not a link');
  await page.locator('#save-button').click();
  await expect(page.locator('#url-error')).toContainText('complete web address');

  await page.locator('#url-input').fill('https://new-bookmark.test/article');
  await page.locator('#save-button').click();
  const fresh = page.locator('[data-bookmark-id]').filter({ hasText: 'A freshly fetched bookmark' });
  await expect(fresh).toBeVisible();
  await page.context().route('https://new-bookmark.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Opened original</title>' }));
  const popupPromise = page.waitForEvent('popup');
  await fresh.locator('.bookmark-display h3').click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/new-bookmark\.test\/article/);
  await popup.close();
  await fresh.getByLabel('Edit bookmark').click();
  await fresh.locator('.edit-form input').first().fill('My corrected title');
  await fresh.locator('.edit-form input').nth(1).fill('acceptance');
  await fresh.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('My corrected title')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show bookmarks labeled acceptance' })).toBeVisible();

  await page.locator('#url-input').fill('https://alistapart.com/article/designing-for-long-form-content/?utm_source=email#comments');
  await page.locator('#save-button').click();
  await expect(page.locator('#toast')).toContainText('Already saved');
  await expect(page.locator('[data-bookmark-id="seed-alistapart"] .edit-form')).toBeVisible();

  await page.locator('#url-input').fill('https://metadata-failure.test/article');
  await page.locator('#save-button').click();
  await expect(page.getByText('We couldn’t load this page’s details')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('button', { name: 'Add details' }).click();
  await expect(page.locator('[data-bookmark-id]').filter({ hasText: 'metadata-failure.test' }).locator('.edit-form')).toBeVisible();
});

test('SCN-003, SCN-005, SCN-014 label creation, reuse, removal, and filtering', async ({ page }) => {
  const card = page.locator('[data-bookmark-id="seed-alistapart"]');
  await card.getByRole('button', { name: '+ Add label' }).click();
  const input = card.getByLabel('New label');
  await input.fill('research');
  await expect(card.locator('.suggestions')).toContainText('Use existing');
  await card.locator('.suggestions button').filter({ hasText: 'research' }).click();
  await expect(card.getByRole('button', { name: 'Show bookmarks labeled research' })).toBeVisible();

  await card.getByRole('button', { name: '+ Add label' }).click();
  await card.getByLabel('New label').fill(' DESIGN ');
  await card.locator('.label-entry button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('already on this bookmark');
  await expect(card.getByRole('button', { name: 'Show bookmarks labeled design' })).toHaveCount(1);

  await card.getByLabel('Remove typography from bookmark').click();
  await expect(card.getByLabel('Remove typography from bookmark')).toHaveCount(0);
  await page.locator('[data-bookmark-id="seed-smashing"]').getByRole('button', { name: 'Show bookmarks labeled design' }).click();
  await expect(page.locator('#result-count')).toHaveText('3 bookmarks');
  await expect(page.locator('.filter-label.include')).toContainText('design');
  await page.locator('#clear-conditions').click();
  await page.locator('.filter-label').filter({ hasText: /^design$/ }).click();
  await expect(page.locator('#result-count')).toHaveText('3 bookmarks');
});

test('SCN-004, SCN-006, SCN-013 plain and precise search states', async ({ page }) => {
  const search = page.locator('#search-input');
  await search.fill('SPACE TELESCOPE');
  await expect(page.locator('#result-count')).toHaveText('1 bookmark');
  await expect(page.getByText('James Webb Space Telescope')).toBeVisible();
  await search.fill('volcano');
  await expect(page.getByRole('heading', { name: 'Nothing found in All bookmarks' })).toBeVisible();
  await search.fill('"design patterns');
  await expect(page.locator('#search-message')).toContainText('Finish with another quotation mark');
  await search.fill('"design patterns"');
  await expect(page.locator('#result-count')).toHaveText('1 bookmark');
  await search.fill('label:design -label:accessibility');
  await expect(page.locator('#result-count')).toHaveText('2 bookmarks');
  await search.fill('grid OR telescope');
  await expect(page.locator('#result-count')).toHaveText('2 bookmarks');
  await search.fill('grid potatoes');
  await page.getByRole('button', { name: 'any word' }).click();
  await expect(page.locator('#result-count')).toHaveText('1 bookmark');
  await search.fill('grid');
  await page.locator('.filter-label').filter({ hasText: /^design$/ }).click();
  await expect(page.locator('#result-count')).toHaveText('1 bookmark');
});

test('SCN-007 and SCN-015 Read Later keeps and clears a focused queue without deleting', async ({ page }) => {
  await page.locator('[data-view="later"]').click();
  await expect(page.locator('#result-count')).toHaveText('1 bookmark');
  const nasa = page.locator('[data-bookmark-id="seed-nasa-webb"]');
  await nasa.getByRole('button', { name: /In Read later/ }).click();
  await expect(page.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible();
  await page.locator('[data-view="all"]').click();
  await expect(page.locator('[data-bookmark-id="seed-nasa-webb"]')).toBeVisible();
});

test('SCN-008, SCN-009, SCN-016 archive, restore, delete, and cancel', async ({ page }) => {
  await page.locator('#search-input').fill('old typography');
  await expect(page.getByRole('heading', { name: 'Nothing found in All bookmarks' })).toBeVisible();
  await page.locator('[data-view="archive"]').click();
  await expect(page.locator('[data-bookmark-id="seed-archived-type"]')).toBeVisible();
  await page.locator('#clear-conditions').click();
  await page.locator('[data-view="all"]').click();
  const aList = page.locator('[data-bookmark-id="seed-alistapart"]');
  await aList.getByLabel('More bookmark actions').click();
  await aList.getByRole('button', { name: 'Move to Archive' }).click();
  await expect(aList).toHaveCount(0);
  await expect(page.locator('#archive-count')).toHaveText('2');
  await page.locator('[data-view="archive"]').click();
  await page.locator('[data-bookmark-id="seed-alistapart"]').getByRole('button', { name: /Restore/ }).click();
  await page.locator('[data-view="all"]').click();
  await expect(page.locator('[data-bookmark-id="seed-alistapart"]')).toBeVisible();

  const grid = page.locator('[data-bookmark-id="seed-mdn-grid"]');
  await grid.getByLabel('More bookmark actions').click();
  await grid.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByRole('button', { name: 'Keep bookmark' }).click();
  await expect(grid).toBeVisible();
  await grid.getByLabel('More bookmark actions').click();
  await grid.getByRole('button', { name: 'Delete permanently' }).click();
  await page.locator('#confirm-delete').click();
  await expect(grid).toHaveCount(0);
});

test('SCN-017 long details remain compact and expand on demand', async ({ page, request }) => {
  await request.patch('/api/bookmarks/seed-mdn-grid', { data: {
    title: 'A very long investigation into how people organize and revisit personal collections of knowledge across many years and changing interests',
    description: 'This unusually detailed description continues far beyond what normally fits comfortably inside a bookmark card and contains information the reader may still want to inspect on demand when they choose to expand the item.',
    labels: ['design', 'reference', 'research', 'knowledge', 'organization']
  } });
  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const card = page.locator('[data-bookmark-id="seed-mdn-grid"]');
  await expect(card).toHaveClass(/compact/);
  await card.getByRole('button', { name: /Show full details/ }).click();
  await expect(card).not.toHaveClass(/compact/);
  await expect(card.getByRole('button', { name: /Show less/ })).toBeVisible();
});

test('SCN-001 empty personal library has a valid ready state', async ({ page, request }) => {
  const response = await request.get('/api/state');
  const current = await response.json();
  for (const bookmark of current.bookmarks) await request.delete(`/api/bookmarks/${bookmark.id}`);
  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your shelf is ready' })).toBeVisible();
});
