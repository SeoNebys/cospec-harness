import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('new bookmarks are unread; unread view filters; mark read removes from unread', async ({ page }) => {
  const k = uid();
  await ready(page);
  const a = await seed(page, { title: `${k} Unread A`, tags: [`${k}t`] });
  await seed(page, { title: `${k} Unread B`, tags: [`${k}t`] });

  // Both appear as unread in the unread view
  await page.click('.view-tab[data-view="unread"]');
  await page.fill('#search', `#${k}t`);
  await expect(page.locator('.card')).toHaveCount(2);

  // Mark A read from its card
  const cardA = page.locator('.card', { hasText: `${k} Unread A` });
  await cardA.getByRole('button', { name: 'Mark read' }).click();

  // A leaves the unread view
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card')).toContainText(`${k} Unread B`);

  // A still exists in All
  await page.click('.view-tab[data-view="all"]');
  await page.fill('#search', `${k} Unread A`);
  await expect(page.locator('.card')).toHaveCount(1);
});
