import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { resetE2eData } from './database.js';

test.beforeEach(() => resetE2eData());

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test('has no detectable issues in empty, form, error, populated, filtered, and delete states', async ({
  page,
}) => {
  await page.goto('/');
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await expect(page.getByLabel('Title')).toBeFocused();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('Title is required.')).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByLabel('Title').fill('Accessible link');
  await page.getByLabel('Web address').fill('https://example.com/accessible');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expectNoAxeViolations(page);

  await page.getByLabel('Search bookmarks').fill('missing');
  await expect(page.getByText('No links match this view')).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Reset search and filters' }).click();
  await page.getByRole('button', { name: 'Delete Accessible link' }).click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Delete Accessible link' })).toBeFocused();
});

test('reflows at 320 CSS pixels and remains usable in forced colors and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await expect(page.getByLabel('Title')).toBeFocused();
  await expectNoAxeViolations(page);
});
