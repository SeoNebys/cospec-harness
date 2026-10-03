import { test, expect } from '@playwright/test';

test('add a tag and filter by it', async ({ page }) => {
  const stamp = Date.now();
  const tag = `e2etag${stamp}`;
  const url = `https://e2e-tag-${stamp}.example.com/x`;
  const title = `E2E Tag ${stamp}`;

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');

  await page.fill('#url-input', url);
  await page.fill('#title-input', title);
  await page.fill('#tags-input', tag);
  await page.click('#save-btn');

  // The saved bookmark shows the tag.
  await page.fill('#search-input', title);
  const item = page.locator('#bookmark-list .bookmark').first();
  await expect(item.locator('.bookmark-tags .tag')).toHaveText(`#${tag}`);

  // Clear search, then filter by the tag.
  await page.fill('#search-input', '');
  await page.getByRole('button', { name: `#${tag}` }).click();

  const results = page.locator('#bookmark-list .bookmark');
  await expect(results).toHaveCount(1);
  await expect(results.first().locator('.bookmark-title')).toHaveText(title);
});
