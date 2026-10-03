import { expect } from '@playwright/test';

export const ORIGIN = 'http://127.0.0.1:4173';
export const uid = () => Math.random().toString(36).slice(2, 8);

// Load the app and wait for the readiness marker. Resets preferences to defaults
// first so tests are independent of each other (shared data dir, serial run).
export async function ready(page) {
  await page.request.put('/api/preferences', {
    data: { default_sort: 'date_added_desc', density: 'comfortable', text_size: 'medium' },
  });
  await page.goto('/');
  await page.waitForSelector('body[data-harness-ready="true"]');
}

// Seed a bookmark directly via the API (fast; no network metadata fetch).
// Returns the created bookmark JSON.
export async function seed(page, { token = uid(), title, description = '', tags = [], is_read = false } = {}) {
  const url = `${ORIGIN}/index.html?seed=${token}`;
  const res = await page.request.post('/api/bookmarks', {
    data: { url, title: title || `Seed ${token}`, description, tags },
  });
  expect(res.ok()).toBeTruthy();
  const bm = await res.json();
  if (is_read) {
    await page.request.patch(`/api/bookmarks/${bm.id}`, { data: { is_read: true } });
  }
  return bm;
}

// Add a bookmark through the review-modal UI (the real save flow).
export async function addViaUi(page, { targetUrl, title, description = '', tags = [] }) {
  const before = await page.locator('.card').count();
  await page.fill('#add-url', targetUrl);
  await page.click('#add-form button[type=submit]');
  await page.waitForSelector('.modal');
  if (title !== undefined) await page.fill('.modal input[type=text]', title);
  if (description) await page.fill('.modal textarea', description);
  for (const t of tags) {
    const input = page.locator('.modal .suggest input');
    await input.fill(t);
    await input.press('Enter');
  }
  await page.click('.modal button.primary');
  await expect(page.locator('.card')).toHaveCount(before + 1);
}
