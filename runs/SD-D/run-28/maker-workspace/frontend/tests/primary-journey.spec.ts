import { test, expect } from '@playwright/test';

// Primary journey: load → save → appears in list → search → open original.
test('save a bookmark, find it by search, and see the open link', async ({ page }) => {
  await page.goto('/');
  // Readiness marker is set only after the initial list/empty state loads.
  await expect(page.locator('#root[data-harness-ready="true"]')).toBeVisible();

  const unique = `pw-${Date.now()}`;
  const url = `https://example.com/${unique}`;
  await page.getByPlaceholder('Paste a URL to save…').fill(url);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // It appears in the list with a link that opens the original address.
  const link = page.locator(`a[href="${url}"]`);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');

  // Search narrows to it (the URL is searchable).
  const search = page.getByPlaceholder(/Search…/);
  await search.fill(unique);
  await search.press('Enter');
  await expect(page.locator(`a[href="${url}"]`)).toBeVisible();

  // A non-matching query yields the no-results state.
  await search.fill('zzz-nomatch-zzz');
  await search.press('Enter');
  await expect(page.getByText('No bookmarks match your search.')).toBeVisible();
});
