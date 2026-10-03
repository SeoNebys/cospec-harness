import { test, expect } from '@playwright/test';
test('approved personal bookmark lifecycle', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByText('Your collection starts here')).toBeVisible();
  await expect(page.locator('#allCount')).toHaveText('0');

  await page.getByRole('button', { name: 'Save your first bookmark' }).click();
  await page.locator('#bookmarkUrl').fill('remember this article');
  await page.getByRole('button', { name: 'Get details' }).click();
  await expect(page.locator('#urlMessage')).toContainText('web address');
  await expect(page.locator('#allCount')).toHaveText('0');

  await page.locator('#bookmarkUrl').fill('https://example.com/');
  await page.getByRole('button', { name: 'Get details' }).click();
  await expect(page.locator('#detailsStep')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#bookmarkTitle')).not.toHaveValue('');
  await page.locator('#bookmarkTitle').fill('Example Keep');
  await page.locator('#bookmarkDescription').fill('A comforting reference page');
  await page.locator('#bookmarkNotes').fill('Share this at the conference');
  await page.locator('#newTag').fill(' Reading ');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('#bookmarkReadLater').check();
  await page.getByRole('button', { name: 'Save bookmark', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Example Keep' })).toBeVisible();
  await expect(page.locator('#allCount')).toHaveText('1');
  await expect(page.locator('#laterCount')).toHaveText('1');
  await expect(page.locator('#tagNav')).toContainText('reading');

  await page.locator('#search').fill('CONFERENCE');
  await expect(page.getByText(/Matched in your note/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Example Keep' })).toBeVisible();
  await page.locator('#clearSearch').click();
  await page.locator('#search').fill('moonbase');
  await expect(page.getByText('No bookmarks found')).toBeVisible();
  await page.locator('#clearSearch').click();
  await page.locator('#tagNav').getByRole('button', { name: /reading/ }).click();
  await expect(page.getByRole('heading', { name: 'Example Keep' })).toBeVisible();

  await page.getByRole('button', { name: /All bookmarks 1/ }).click();
  await page.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByText('Share this at the conference')).toBeVisible();
  await page.locator('#closeDetails').click();

  await page.locator('#newBookmark').click();
  await page.locator('#bookmarkUrl').fill('https://EXAMPLE.com/#section');
  await page.getByRole('button', { name: 'Get details' }).click();
  await expect(page.locator('#duplicateNote')).toBeVisible();
  await expect(page.locator('#allCount')).toHaveText('1');
  await page.locator('#closeDetails').click();

  await page.getByRole('button', { name: /Read later 1/ }).click();
  await page.getByRole('button', { name: '✓ Mark as read' }).click();
  await expect(page.getByText('You’re all caught up')).toBeVisible();
  await expect(page.locator('#allCount')).toHaveText('1');

  await page.getByRole('button', { name: /All bookmarks 1/ }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.locator('#archiveCount')).toHaveText('1');
  await page.getByRole('button', { name: /Archive 1/ }).click();
  await page.getByRole('button', { name: 'Restore to collection' }).click();
  await expect(page.getByText('Archive is empty')).toBeVisible();
  await expect(page.locator('#allCount')).toHaveText('1');

  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Example Keep' })).toBeVisible();
});

test('manual metadata fallback and long-card boundary', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await page.locator('#newBookmark').click();
  await page.locator('#bookmarkUrl').fill('https://page-that-does-not-exist.invalid/article');
  await page.getByRole('button', { name: 'Get details' }).click();
  await expect(page.locator('#fetchWarning')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#saveChanges')).toBeDisabled();
  await page.locator('#bookmarkTitle').fill('Manual bookmark');
  await expect(page.locator('#saveChanges')).toBeEnabled();
  await page.locator('#bookmarkDescription').fill('Entered after the page could not be read');
  await page.getByRole('button', { name: 'Save bookmark', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manual bookmark' })).toBeVisible();

  const longTitle = 'A very long exploration of how thoughtful reading habits change the way we remember, connect, and understand difficult ideas over time';
  const response = await request.post('/api/bookmarks', { data: { url: 'https://example.org/long-article', title: longTitle, description: 'An unusually detailed description that continues far beyond what a compact collection card could reasonably display without making every row difficult to scan.', notes: 'The full content remains available.', tags: ['reading'] } });
  expect(response.ok()).toBeTruthy();
  await page.reload(); await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const cards = page.locator('.bookmark-card'); await expect(cards).toHaveCount(3);
  const heights = await cards.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(3);
  await expect(page.getByRole('heading', { name: longTitle })).toBeVisible();
});
