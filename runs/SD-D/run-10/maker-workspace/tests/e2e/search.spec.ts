import { expect, test } from '@playwright/test';
import { saveBookmark, signIn } from './helpers';

test('searches exact phrases and preserves invalid input with an actionable error', async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const title = `Climate policy ${suffix}`;
  await signIn(page);
  await saveBookmark(page, { url: `https://example.com/search-${suffix}`, title });
  const search = page.getByLabel('Search bookmarks');
  await search.fill(`"${title}"`);
  await expect(page.getByRole('button', { name: `View details for ${title}` })).toBeVisible();
  await search.fill('privacy AND');
  await expect(search).toHaveValue('privacy AND');
  await expect(page.getByRole('alert')).toContainText('Expected a term after AND');
});
