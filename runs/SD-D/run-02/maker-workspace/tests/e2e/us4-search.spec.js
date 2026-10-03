import { test, expect } from '@playwright/test';
import { seedBookmark } from './helpers.js';

test.beforeEach(async ({ request }) => {
  await seedBookmark(request, { url: 'https://s-rust.example', title: 'Rust guide', tags: ['lang'], description: 'systems' });
  await seedBookmark(request, { url: 'https://s-python.example', title: 'Python flask', tags: ['lang', 'web'] });
  await seedBookmark(request, { url: 'https://s-go.example', title: 'Go routines', tags: ['lang'] });
});

async function search(page, q) {
  await page.goto('/');
  await page.getByLabel('Search').fill(q);
  await page.getByLabel('Search').press('Enter');
}

test('case-insensitive keyword search', async ({ page }) => {
  await search(page, 'RUST');
  await expect(page.locator('.card', { hasText: 'Rust guide' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Python flask' })).toHaveCount(0);
});

test('#tag combined with a word requires both', async ({ page }) => {
  await search(page, '#web flask');
  await expect(page.locator('.card', { hasText: 'Python flask' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Rust guide' })).toHaveCount(0);
});

test('boolean grouping', async ({ page }) => {
  await search(page, '#lang AND (rust OR go)');
  await expect(page.locator('.card', { hasText: 'Rust guide' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Go routines' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Python flask' })).toHaveCount(0);
});

test('invalid expression shows a clear error', async ({ page }) => {
  await search(page, 'rust AND (go');
  await expect(page.locator('.banner.error')).toBeVisible();
});
