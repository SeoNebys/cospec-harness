import { expect, test } from '@playwright/test';
import { resetE2eData } from './database.js';

test.beforeEach(() => resetE2eData());

test('saves, opens, validates, and catches a duplicate bookmark', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('Save your first useful link')).toBeVisible();

  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Title').fill('OpenAI');
  await page.getByLabel('Web address').fill('https://openai.com/research/');
  await page.getByLabel('Notes').fill('Read later');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByRole('heading', { name: 'OpenAI' })).toBeVisible();

  const popupPromise = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Open OpenAI' }).click();
  const popup = await popupPromise;
  expect(popup.url()).toContain('openai.com/research');

  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Title').fill('Duplicate');
  await page.getByLabel('Web address').fill('https://openai.com/research');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('This link is already saved.')).toBeVisible();
});

test('keeps entered values when validation fails', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Title').fill('Keep me');
  await page.getByLabel('Web address').fill('not a link');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('Enter a valid HTTP or HTTPS address.')).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('Keep me');
});
