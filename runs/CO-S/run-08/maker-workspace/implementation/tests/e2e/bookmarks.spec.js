'use strict';

const { test, expect } = require('@playwright/test');

const EMAIL = 'me@example.com';
const PASSWORD = 'secret123';

// Sign in, registering the single account the first time it is needed.
async function signIn(page, { stay = true } = {}) {
  await page.goto('/');
  await expect(page.locator('#auth-view')).toBeVisible();
  await page.fill('#auth-email', EMAIL);
  await page.fill('#auth-password', PASSWORD);
  const heading = await page.locator('#auth-heading').textContent();
  if (heading.includes('Create your account')) {
    await page.fill('#auth-confirm', PASSWORD);
  }
  if (!stay) await page.uncheck('#auth-stay');
  await page.click('#auth-submit');
  await expect(page.locator('#app-view')).toBeVisible();
}

async function addLink(page, url, title, topic) {
  await page.fill('#url', url);
  await page.fill('#title', title);
  await page.fill('#topic', topic);
  await page.click('#save');
}

test.describe.configure({ mode: 'serial' });

test('SCN-011/006: register lands in the empty state', async ({ page }) => {
  await signIn(page);
  await expect(page.locator('.empty')).toContainText('No links saved yet');
  await expect(page.locator('#account-email')).toContainText(EMAIL);
});

test('SCN-001: save a link, grouped under its topic with a count', async ({ page }) => {
  await signIn(page);
  await addLink(page, 'https://smashingmagazine.com', 'Smashing', 'Design');
  const group = page.locator('.topic-group', { hasText: 'Design' });
  await expect(group.locator('.topic-head')).toContainText('Design');
  await expect(group.locator('.topic-count')).toHaveText('1');
  await expect(group.locator('.bm-main a')).toContainText('Smashing');
});

test('SCN-009: address without scheme becomes clickable https link', async ({ page }) => {
  await signIn(page);
  await addLink(page, 'example.com', 'Example', 'Misc');
  const link = page.locator('.topic-group', { hasText: 'Misc' }).locator('.bm-main a');
  await expect(link).toHaveAttribute('href', 'https://example.com');
});

test('SCN-002: search narrows the list and reports a count', async ({ page }) => {
  await signIn(page);
  await addLink(page, 'https://bbcgoodfood.com', 'BBC Good Food', 'Recipes');
  await page.fill('#search', 'food');
  await expect(page.locator('#search-meta')).toContainText('link found');
  await expect(page.locator('.bm-main a', { hasText: 'Good Food' })).toBeVisible();
  await expect(page.locator('.bm-main a', { hasText: 'Smashing' })).toHaveCount(0);
});

test('SCN-002: search with no matches shows a distinct message', async ({ page }) => {
  await signIn(page);
  await page.fill('#search', 'zzzznope');
  await expect(page.locator('.empty')).toContainText('No links match');
});

test('SCN-003: topic buttons filter, and All clears the search', async ({ page }) => {
  await signIn(page);
  await page.click('.chip:has-text("Design")');
  await expect(page.locator('.topic-group')).toHaveCount(1);
  await page.fill('#search', 'smashing');
  await expect(page.locator('#search-meta')).toContainText('link found');
  await page.click('.chip:has-text("All")');
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('.topic-group').first()).toBeVisible();
});

test('SCN-008: saving an existing address opens it for editing, no duplicate', async ({ page }) => {
  await signIn(page);
  const before = await page.locator('.bm').count();
  await addLink(page, 'smashingmagazine.com/', '', '');
  await expect(page.locator('#save-notice')).toContainText('already saved');
  await expect(page.locator('.edit-form')).toBeVisible();
  await page.click('.cancel-edit');
  await expect(page.locator('.bm')).toHaveCount(before);
});

test('SCN-004: edit a link in place moves it to a new topic', async ({ page }) => {
  await signIn(page);
  const row = page.locator('.bm', { hasText: 'BBC Good Food' });
  await row.locator('.edit-btn').click();
  await page.fill('.edit-form .e-topic', 'Cooking');
  await page.click('.save-edit');
  await expect(page.locator('.topic-group', { hasText: 'Cooking' })).toBeVisible();
  await expect(page.locator('.chip', { hasText: 'Cooking' })).toBeVisible();
});

test('SCN-005: delete asks to confirm; Keep cancels, Delete removes', async ({ page }) => {
  await signIn(page);
  const row = page.locator('.bm', { hasText: 'Example' });
  await row.locator('.del-btn').click();
  await expect(page.locator('.confirm-del')).toContainText('Delete');
  await page.click('.confirm-del .no');
  await expect(page.locator('.bm', { hasText: 'Example' })).toBeVisible();

  await page.locator('.bm', { hasText: 'Example' }).locator('.del-btn').click();
  await page.click('.confirm-del .yes');
  await expect(page.locator('.bm', { hasText: 'Example' })).toHaveCount(0);
});

test('SCN-010: saving without an address does nothing', async ({ page }) => {
  await signIn(page);
  const before = await page.locator('.bm').count();
  await page.fill('#url', '');
  await page.fill('#title', 'No address');
  await page.click('#save');
  await expect(page.locator('.bm')).toHaveCount(before);
});

test('SCN-011: stay-signed-in survives a reload; sign out returns to login', async ({ page }) => {
  await signIn(page, { stay: true });
  await page.reload();
  await expect(page.locator('#app-view')).toBeVisible(); // still signed in
  await page.click('#signout');
  await expect(page.locator('#auth-view')).toBeVisible();
});

test('SCN-011: wrong password is rejected', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#auth-heading')).toContainText('Welcome back'); // account already exists
  await page.fill('#auth-email', EMAIL);
  await page.fill('#auth-password', 'wrongpass');
  await page.click('#auth-submit');
  await expect(page.locator('#auth-msg')).toContainText('not correct');
  await expect(page.locator('#auth-view')).toBeVisible();
});
