import { test, expect } from '@playwright/test';
import { clearAll, seed } from './helper.js';

test.beforeEach(async ({ request }) => { await clearAll(request); });

test('US4: list shows fields and sorts by title', async ({ page, request }) => {
  await seed(request, 'https://a.com/z', { title: 'Zebra', description: 'stripes', tags: ['animals'] });
  await seed(request, 'https://a.com/a', { title: 'Apple', description: 'fruit', tags: ['food'] });
  await page.goto('/');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();
  await page.selectOption('#sort', 'title_asc');
  const titles = page.locator('.bookmark .title');
  await expect(titles.first()).toHaveText('Apple');
  await expect(page.locator('.bookmark', { hasText: 'Apple' }).locator('.tag')).toHaveText('#food');
});

test('US5: advanced search filters results', async ({ page, request }) => {
  await seed(request, 'https://a.com/1', { title: 'Open Source', tags: ['news'] });
  await seed(request, 'https://a.com/2', { title: 'Cats', tags: ['pets'] });
  await page.goto('/');
  await page.fill('#search', '#news AND "Open Source"');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark .title')).toHaveText('Open Source');
  // Invalid query surfaces an error.
  await page.fill('#search', '"unbalanced');
  await expect(page.locator('.search-error')).toBeVisible();
});

test('US6: read-later and unread view', async ({ page, request }) => {
  const b = await seed(request, 'https://a.com/unread', { title: 'ToRead' });
  await page.goto('/#/unread');
  await expect(page.locator('.bookmark', { hasText: 'ToRead' })).toBeVisible();
  await page.locator(`.bookmark[data-id="${b.id}"] button`, { hasText: 'Mark read' }).click();
  await expect(page.locator('.empty')).toBeVisible();
});

test('US7: tag include filter', async ({ page, request }) => {
  await seed(request, 'https://a.com/1', { title: 'Tagged', tags: ['keep'] });
  await seed(request, 'https://a.com/2', { title: 'Untagged' });
  await page.goto('/');
  await page.fill('#search', '#keep');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark .title')).toHaveText('Tagged');
});

test('US8: bulk archive via select-all-matching', async ({ page, request }) => {
  await seed(request, 'https://a.com/1', { title: 'match one' });
  await seed(request, 'https://a.com/2', { title: 'match two' });
  await seed(request, 'https://a.com/3', { title: 'other' });
  await page.goto('/');
  await page.fill('#search', 'match');
  await expect(page.locator('.bookmark')).toHaveCount(2);
  await page.locator('.bookmark .select').first().check();
  await page.locator('.bulk-bar button', { hasText: 'Select all' }).click();
  page.on('dialog', (d) => d.accept());
  await page.locator('.bulk-bar button', { hasText: 'Archive' }).click();
  await expect(page.locator('.empty')).toBeVisible();
  // The two matches now live in the archive.
  await page.goto('/#/archive');
  await expect(page.locator('.bookmark')).toHaveCount(2);
});

test('US9: archive hides then restore returns', async ({ page, request }) => {
  const b = await seed(request, 'https://a.com/keep', { title: 'Keeper' });
  await page.goto('/');
  await page.locator(`.bookmark[data-id="${b.id}"] button`, { hasText: 'Archive' }).click();
  await expect(page.locator('.empty')).toBeVisible();
  await page.goto('/#/archive');
  await page.locator(`.bookmark[data-id="${b.id}"] button`, { hasText: 'Restore' }).click();
  await page.goto('/');
  await expect(page.locator('.bookmark', { hasText: 'Keeper' })).toBeVisible();
});
