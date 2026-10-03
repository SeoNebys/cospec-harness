import { test, expect } from '@playwright/test';

const SEED = [
  { url: 'https://a.com/1', title: 'Alpha', tags: ['reference'] },
  { url: 'https://b.com/2', title: 'Bravo', tags: ['reference'] },
  { url: 'https://c.com/3', title: 'Charlie', tags: ['other'] }
];

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/_test/reset');
  for (const b of SEED) await page.request.post('/api/bookmarks', { data: b });
  await page.goto('/');
  await page.waitForSelector('[data-harness-ready="true"]');
});

// SCN-005
test('SCN-005: read later stays in All with a flag and appears in its lane', async ({ page }) => {
  const alpha = page.locator('.bm', { hasText: 'Alpha' });
  await alpha.locator('[data-act="later"]').click();

  await expect(page.locator('#vc-later')).toHaveText('(1)');
  await expect(alpha.locator('.flag')).toHaveText('Read later'); // still in All, flagged
  await expect(page.locator('.bm')).toHaveCount(3);

  await page.click('[data-view="later"]');
  await expect(page.locator('.bm')).toHaveCount(1);
  await expect(page.locator('.bm .title')).toContainText('Alpha');
});

// SCN-005
test('SCN-005: mark as read retires it from the lane but keeps it in All', async ({ page }) => {
  const alpha = page.locator('.bm', { hasText: 'Alpha' });
  await alpha.locator('[data-act="later"]').click();
  await page.click('[data-view="later"]');
  await page.locator('.bm [data-act="markread"]').click();
  await expect(page.locator('.bm')).toHaveCount(0);
  await expect(page.locator('#vc-later')).toHaveText('(0)');

  await page.click('[data-view="all"]');
  await expect(page.locator('.bm')).toHaveCount(3);
  await expect(page.locator('.flag')).toHaveCount(0);
});

// SCN-006
test('SCN-006: archive hides from All and from normal search; searchable in Archived', async ({ page }) => {
  const alpha = page.locator('.bm', { hasText: 'Alpha' });
  await alpha.locator('[data-act="archive"]').click();

  await expect(page.locator('.bm')).toHaveCount(2); // gone from All
  await expect(page.locator('#vc-archived')).toHaveText('(1)');

  // not in normal (All) search
  await page.fill('#search', 'Alpha');
  await expect(page.locator('.empty')).toContainText('No bookmarks match');
  await page.fill('#search', '');

  // searchable within Archived view
  await page.click('[data-view="archived"]');
  await expect(page.locator('.bm')).toHaveCount(1);
  await page.fill('#search', 'Alpha');
  await expect(page.locator('.bm')).toHaveCount(1);
});

// SCN-006
test('SCN-006: restore brings an archived bookmark back to All', async ({ page }) => {
  const alpha = page.locator('.bm', { hasText: 'Alpha' });
  await alpha.locator('[data-act="archive"]').click();
  await page.click('[data-view="archived"]');
  await page.locator('.bm [data-act="restore"]').click();
  await expect(page.locator('.bm')).toHaveCount(0); // archived now empty
  await page.click('[data-view="all"]');
  await expect(page.locator('.bm')).toHaveCount(3);
});

// SCN-008
test('SCN-008: tailored empty messages per view', async ({ page }) => {
  await page.request.post('/api/_test/reset');
  await page.reload();
  await page.waitForSelector('[data-harness-ready="true"]');
  await expect(page.locator('.empty')).toContainText('Nothing here yet');
  await page.click('[data-view="later"]');
  await expect(page.locator('.empty')).toContainText('No bookmarks marked');
  await page.click('[data-view="archived"]');
  await expect(page.locator('.empty')).toContainText('Nothing archived');
});
