import { expect, test } from '@playwright/test';
import axe from 'axe-core';

test('empty application has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const runner = (globalThis as typeof globalThis & { axe: { run(): Promise<{ violations: Array<{ id: string }> }> } }).axe;
    return (await runner.run()).violations.map((violation) => violation.id);
  });
  expect(violations).toEqual([]);
});

test('save, combined search, read later, edit, and delete', async ({ page }) => {
  const url = `https://example.com/rome-${Date.now()}`;
  await page.route('**/api/metadata/preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({data:{requestedUrl:url,finalUrl:url,outcome:'complete',fields:{title:{status:'found',value:'Ancient Rome reading',source:'title'},description:{status:'found',value:'A guide to the ancient city',source:'description'},icon:{status:'missing',value:null,source:null}},iconToken:null,warnings:[]}}),
    });
  });
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await page.getByLabel('Web address').fill(url);
  await page.getByRole('button', { name: 'Get details' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Ancient Rome reading');
  await page.getByLabel('Tags (comma separated)').fill('article, book');
  await page.getByLabel('Read this later').check();
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  const card = page.locator('article', { hasText: 'Ancient Rome reading' });
  await expect(card).toBeVisible();

  await page.getByPlaceholder(/Search bookmarks/).fill('Rome tag:(article|book)');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('Tag is any of: article, book')).toBeVisible();
  await expect(card).toBeVisible();

  await page.getByRole('button', { name: /Read later/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Read later', level: 1 })).toBeVisible();
  await expect(page.locator('article', { hasText: 'Ancient Rome reading' })).toBeVisible();
  await page.getByRole('button', { name: /Mark read/ }).click();
  await expect(page.locator('article', { hasText: 'Ancient Rome reading' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Library' }).click();
  const libraryCard = page.locator('article', { hasText: 'Ancient Rome reading' });
  await expect(libraryCard).toBeVisible();
  await libraryCard.getByRole('button', { name: /Edit/ }).click();
  await page.getByRole('dialog').getByLabel('Title').fill('Rome handbook');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('article', { hasText: 'Rome handbook' })).toBeVisible();
  const revised = page.locator('article', { hasText: 'Rome handbook' });
  await revised.getByRole('button', { name: /Delete/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expect(revised).toHaveCount(0);
});
