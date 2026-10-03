import { test, expect } from '@playwright/test';

test('saves with editable metadata and fallback', async ({ page }, info) => {
  const unique = `save-${Date.now()}-${info.project.name}`;
  await page.route('**/api/metadata-preview', route => route.fulfill({ json: { normalizedUrl: `https://${unique}.example.com/`, status: 'available', title: 'Fetched title', description: 'Fetched description', message: null } }));
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const form = page.locator('form.save-panel');
  await form.getByLabel('Web address').fill(`${unique}.example.com`);
  await expect(form.getByLabel(/Title/)).toHaveValue('Fetched title');
  const editedTitle = `My edited ${unique}`;
  await form.getByLabel(/Title/).fill(editedTitle);
  await form.getByLabel(/Tags/).fill('reading, useful');
  await form.getByRole('button', { name: /Save bookmark/ }).click();
  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
});
