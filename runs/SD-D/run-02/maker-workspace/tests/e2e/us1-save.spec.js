import { test, expect } from '@playwright/test';
import { startFixtureServer } from './fixture-server.js';

let fixture;
test.beforeAll(async () => {
  fixture = await startFixtureServer();
});
test.afterAll(async () => {
  await new Promise((r) => fixture.server.close(r));
});

test('empty state invites the first bookmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.getByText('No bookmarks yet')).toBeVisible();
});

test('save a link, auto-capture details, then edit them', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Save bookmark' }).first().click();
  await page.getByTestId('field-url').fill(`${fixture.base}/page?n=1`);
  await page.getByTestId('dialog-submit').click();

  const card = page.locator('.card', { hasText: 'Fixture Page 1' });
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card).toContainText('Description for fixture 1.', { timeout: 15000 });

  // Edit the title + add a tag.
  await card.getByRole('button', { name: 'Edit' }).click();
  await page.getByTestId('field-title').fill('Renamed One');
  await page.getByTestId('dialog-submit').click();
  await expect(page.locator('.card', { hasText: 'Renamed One' })).toBeVisible();
});

test('saving a duplicate opens the existing bookmark instead of adding one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Save bookmark' }).first().click();
  await page.getByTestId('field-url').fill(`${fixture.base}/page?n=1`);
  await page.getByTestId('dialog-submit').click();
  // Banner explains, and the edit dialog opens on the existing bookmark.
  await expect(page.getByText('already bookmarked')).toBeVisible();
  await expect(page.getByTestId('field-url')).toHaveValue(`${fixture.base}/page?n=1`);
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('rejects an invalid (non-http) address', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Save bookmark' }).first().click();
  await page.getByTestId('field-url').fill('javascript:alert(1)');
  await page.getByTestId('dialog-submit').click();
  await expect(page.locator('.form-error')).toBeVisible();
});

test('delayed metadata never overwrites a title entered at save time', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Save bookmark' }).first().click();
  await page.getByTestId('field-url').fill(`${fixture.base}/page?n=2`);
  await page.getByTestId('field-title').fill('My Own Title');
  await page.getByTestId('dialog-submit').click();

  const card = page.locator('.card', { hasText: 'My Own Title' });
  await expect(card).toBeVisible();
  // Give the async metadata fetch time to complete; the user title must survive
  // and the fetched "Fixture Page 2" must NOT replace it.
  await page.waitForTimeout(4000);
  await expect(page.locator('.card', { hasText: 'My Own Title' })).toBeVisible();
  await expect(page.locator('.card-title', { hasText: 'Fixture Page 2' })).toHaveCount(0);
});
