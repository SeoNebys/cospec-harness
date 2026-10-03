import { expect, type Page } from '@playwright/test';

export async function signIn(page: Page) {
  await page.goto('/');
  if (
    await page
      .getByRole('button', { name: 'Sign in' })
      .isVisible()
      .catch(() => false)
  )
    await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
}

export async function navigate(page: Page, name: string) {
  await page.locator('nav:visible button').filter({ hasText: name }).first().click();
}

export async function saveBookmark(
  page: Page,
  input: { url: string; title: string; readLater?: boolean; favorite?: boolean },
) {
  await page.route('**/api/metadata/preview', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        requestedUrl: input.url,
        finalUrl: input.url,
        title: { value: input.title, source: 'html_title' },
        description: { value: 'Test description', source: 'meta_description' },
        favicon: { value: null, source: 'favicon_fallback' },
        previewImage: { value: null, source: 'open_graph' },
        warnings: [],
      }),
    }),
  );
  await page
    .getByRole('button', { name: /Add bookmark/ })
    .first()
    .click();
  const editor = page.getByRole('dialog', { name: 'Save a bookmark' });
  await editor.getByLabel('Web address').fill(input.url);
  await expect(editor.getByRole('textbox', { name: /^Title/ })).toHaveValue(input.title);
  if (input.readLater) await editor.getByText('Add to Read Later').click();
  if (input.favorite) await editor.getByText('Favorite', { exact: true }).click();
  await editor.getByRole('button', { name: 'Keep this bookmark' }).click();
  await expect(page.getByRole('dialog', { name: input.title })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
}
