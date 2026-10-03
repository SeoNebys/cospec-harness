import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('bookmark workflow works', async ({ page }) => {
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByText('6 bookmarks')).toBeVisible();
  await page.getByRole('button', { name: 'Add bookmark' }).first().click();
  await page.getByLabel('Website URL').fill('example.com/great-article');
  await page.getByLabel('Title Optional').fill('A Great Article');
  await page.getByLabel('Description Optional').fill('Something useful to read later.');
  await page.getByLabel('Tags Optional').fill('useful, article');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('A Great Article')).toBeVisible();
  await expect(page.getByText('7 bookmarks')).toBeVisible();
  await page.getByLabel('Search bookmarks').fill('Great Article');
  await expect(page.getByText('1 bookmark')).toBeVisible();
});

test('pasting a URL fills page details automatically', async ({ page }) => {
  await page.route('**/api/metadata?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Automatically discovered title',
        description: 'A description pulled directly from the page.',
        icon: 'https://example.com/favicon.ico',
        url: 'https://example.com/article'
      })
    });
  });
  await page.getByRole('button', { name: 'Add bookmark' }).first().click();
  await page.getByLabel('Website URL').fill('https://example.com/article');
  await expect(page.getByLabel('Title Optional')).toHaveValue('Automatically discovered title');
  await expect(page.getByLabel('Description Optional')).toHaveValue('A description pulled directly from the page.');
  await expect(page.getByText('Page details added automatically.')).toBeVisible();
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('Automatically discovered title')).toBeVisible();
});

test('to-read queue can be filtered and checked off', async ({ page }) => {
  await page.locator('.sidebar').getByRole('button', { name: /To read/ }).click();
  await expect(page.getByRole('heading', { name: 'To read' })).toBeVisible();
  await expect(page.getByText('3 bookmarks')).toBeVisible();
  await page.getByRole('button', { name: 'Mark read' }).first().click();
  await expect(page.getByText('2 bookmarks')).toBeVisible();
  await expect(page.getByText('Marked as read')).toBeVisible();
});

test('filters and view toggle work', async ({ page }) => {
  await page.getByRole('button', { name: /Favorites/ }).click();
  await expect(page.getByText('3 bookmarks')).toBeVisible();
  await page.getByRole('button', { name: 'List view' }).click();
  await expect(page.locator('.bookmark-layout')).toHaveClass(/list/);
});
