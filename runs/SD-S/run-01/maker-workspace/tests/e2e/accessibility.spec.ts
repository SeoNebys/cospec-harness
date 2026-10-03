import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { resetBookmarks } from '../fixtures/bookmarks';

test.beforeEach(() => resetBookmarks());

test('loaded collection and form have no detectable WCAG A/AA violations', async ({ page }, testInfo) => {
  await page.request.post('/api/bookmarks', { data: { url: `https://example.com/a11y/${testInfo.project.name}`, title: `Accessible example ${testInfo.project.name}`, notes: 'Useful context', tags: ['Research'] } });
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('button', { name: /add bookmark/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await expect(page.getByRole('textbox', { name: 'Web address' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeFocused();
});
