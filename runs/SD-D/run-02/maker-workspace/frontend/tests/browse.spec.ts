import { test, expect } from '@playwright/test';
import { resetAll } from './helpers.js';

const FIXTURE = 'http://127.0.0.1:4600';

/**
 * US2 (T022): browse, sort, and open — plus read-later and a "not this tag"
 * search, seeded through the API and then driven through the UI.
 */
test.beforeEach(async ({ request }) => {
  await resetAll(request);
  await request.post('/api/bookmarks', { data: { url: `${FIXTURE}/article`, tags: ['keep'] } });
  await request.post('/api/bookmarks', { data: { url: `${FIXTURE}/second`, tags: ['work'] } });
});

test('lists bookmarks with their tags and opens to the real page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(`${FIXTURE}/article`)).toBeVisible();
  await expect(page.getByText(`${FIXTURE}/second`)).toBeVisible();

  // Tags are shown in the list.
  await expect(page.locator('.card', { hasText: '/article' }).getByText('keep')).toBeVisible();

  // The title links to the actual page.
  const link = page.locator('.card', { hasText: '/article' }).locator('.card-title');
  await expect(link).toHaveAttribute('href', `${FIXTURE}/article`);
});

test('sorting keeps the full list', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Sort').selectOption('title');
  await expect(page.locator('.card')).toHaveCount(2);
  await page.getByLabel('Sort').selectOption('oldest');
  await expect(page.locator('.card')).toHaveCount(2);
});

test('read-later shows only what I marked', async ({ page }) => {
  await page.goto('/');
  await page.locator('.card', { hasText: '/article' }).getByRole('button', { name: 'Read later' }).click();

  await page.getByRole('button', { name: 'Read later' }).first().click(); // nav tab
  await expect(page.getByText(`${FIXTURE}/article`)).toBeVisible();
  await expect(page.getByText(`${FIXTURE}/second`)).toHaveCount(0);
});

test('search can exclude a tag', async ({ page }) => {
  await page.goto('/');
  await page.locator('.search').fill('article -tag:work');
  await expect(page.getByText(`${FIXTURE}/article`)).toBeVisible();
  await expect(page.getByText(`${FIXTURE}/second`)).toHaveCount(0);
});
