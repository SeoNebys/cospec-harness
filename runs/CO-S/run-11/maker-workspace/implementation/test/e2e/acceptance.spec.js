'use strict';
const { test, expect } = require('@playwright/test');

// Deterministic auto-fill: stub the metadata endpoint per test.
async function stubMetadata(page, mode = 'ok') {
  await page.route('**/api/metadata**', (route) => {
    if (mode === 'fail') return route.fulfill({ json: { ok: false, title: '', description: '' } });
    return route.fulfill({ json: { ok: true, title: 'Stub Title', description: 'Stub description.' } });
  });
}

const ACCOUNT = { email: `e2e_${Date.now()}@x.com`, password: 'demo123' };

async function ensureSignedIn(page) {
  await page.goto('/');
  if (await page.locator('#signin').isVisible()) {
    await page.fill('#email', ACCOUNT.email);
    await page.fill('#password', ACCOUNT.password);
    await page.click('#authSubmit');
    await expect(page.locator('#app')).toBeVisible();
  }
}
async function openSaver(page) {
  const isOpen = await page.locator('#saver').evaluate((el) => el.open);
  if (!isOpen) await page.locator('#saver summary').click();
}
async function addBookmark(page, url, { tags = [], note = '' } = {}) {
  await openSaver(page);
  await page.fill('#url', url);
  await page.locator('#url').blur();
  await expect(page.locator('#saveStatus')).not.toHaveText('Fetching details…', { timeout: 5000 });
  if (note) await page.fill('#note', note);
  for (const tag of tags) { await page.fill('#taginput', tag); await page.keyboard.press('Enter'); }
  await page.click('#save');
}

test.describe.configure({ mode: 'serial' });

test('SCN-013: wrong sign-in is rejected, then register shows empty state (SCN-005)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('#signin')).toBeVisible();

  // wrong credentials
  await page.fill('#email', 'nobody@x.com');
  await page.fill('#password', 'wrongpass');
  await page.click('#authSubmit');
  await expect(page.locator('#authError')).toContainText("isn't right");
  await expect(page.locator('#app')).toBeHidden();

  // register a fresh account
  await page.click('#switchLink');
  await page.fill('#email', ACCOUNT.email);
  await page.fill('#password', ACCOUNT.password);
  await page.click('#authSubmit');
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#empty')).toContainText('No bookmarks yet');
  await expect(page.locator('#badge-toread')).toHaveText('0');
});

test('SCN-001/002/008: save with auto-fill, tags and note', async ({ page }) => {
  await stubMetadata(page, 'ok');
  await ensureSignedIn(page);
  await addBookmark(page, 'https://developer.mozilla.org/en-US/docs/Web/CSS/Flexbox', { tags: ['css', 'reference'], note: 'layout basics' });
  const item = page.locator('li.item').first();
  await expect(item.locator('.title')).toContainText('Stub Title');
  await expect(item.locator('.note')).toContainText('layout basics');
  await expect(item.locator('.chip')).toHaveCount(2);
  await expect(page.locator('#badge-toread')).toHaveText('1');
});

test('SCN-009: invalid link message and auto-fill failure still allows saving', async ({ page }) => {
  await ensureSignedIn(page);
  await openSaver(page);
  await page.fill('#url', 'not a real link');
  await page.locator('#url').blur();
  await expect(page.locator('#saveStatus')).toContainText("doesn’t look like a web link");
  await expect(page.locator('#save')).toBeDisabled();

  await stubMetadata(page, 'fail');
  await page.fill('#url', 'https://broken.example.com/page');
  await page.locator('#url').blur();
  await expect(page.locator('#saveStatus')).toContainText("Couldn’t fetch details");
  await page.fill('#title', 'Typed manually');
  await expect(page.locator('#save')).toBeEnabled();
  await page.click('#save');
  await expect(page.locator('li.item').filter({ hasText: 'Typed manually' })).toHaveCount(1);
});

test('SCN-004: live search across fields, spanning tabs, with tag filter', async ({ page }) => {
  await stubMetadata(page, 'ok');
  await ensureSignedIn(page);
  // search by the note text of the flexbox bookmark
  await page.fill('#search', 'layout basics');
  await expect(page.locator('li.item')).toHaveCount(1);
  await expect(page.locator('#searchmeta')).toContainText('across both tabs');
  await page.fill('#search', '');

  // finish one, then confirm search still finds it from the To read tab
  const flex = page.locator('li.item').filter({ hasText: 'Stub Title' }).first();
  await flex.getByRole('button', { name: '✓ Finished' }).click();
  await expect(page.locator('#badge-finished')).toHaveText('1');
  await page.fill('#search', 'Stub');
  await expect(page.locator('li.item').filter({ hasText: 'Stub Title' })).toHaveCount(1);
  await page.fill('#search', '');

  // tag click filters
  await page.locator('#tabs button[data-t="finished"]').click();
  await page.locator('li.item .chip', { hasText: '#reference' }).first().click();
  await expect(page.locator('#searchmeta')).toContainText('#reference');
  await page.locator('#searchmeta .activefilter button').click();
});

test('SCN-011: archive hides from lists, restore brings it back with status', async ({ page }) => {
  await ensureSignedIn(page);
  const finishedTab = page.locator('#tabs button[data-t="finished"]');
  await finishedTab.click();
  const item = page.locator('li.item').filter({ hasText: 'Stub Title' }).first();
  await item.getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('#badge-finished')).toHaveText('0');
  await expect(page.locator('#badge-archived')).toHaveText('1');

  // excluded from normal search
  await page.locator('#tabs button[data-t="toread"]').click();
  await page.fill('#search', 'Stub');
  await expect(page.locator('li.item').filter({ hasText: 'Stub Title' })).toHaveCount(0);
  await page.fill('#search', '');

  // restore keeps Finished status
  await page.locator('#tabs button[data-t="archived"]').click();
  await page.locator('li.item').filter({ hasText: 'Stub Title' }).getByRole('button', { name: '↩ Restore' }).click();
  await expect(page.locator('#badge-finished')).toHaveText('1');
  await expect(page.locator('#badge-archived')).toHaveText('0');
});

test('SCN-006: duplicate save points to the existing bookmark and opens edit', async ({ page }) => {
  await stubMetadata(page, 'ok');
  await ensureSignedIn(page);
  await addBookmark(page, 'https://DEVELOPER.mozilla.org/en-US/docs/Web/CSS/Flexbox/'); // same as earlier, different case/slash
  await expect(page.locator('#saveStatus')).toContainText('already saved this');
  // navigated to Finished tab (that bookmark is finished) and opened its editor
  await expect(page.locator('#tabs button[data-t="finished"]')).toHaveClass(/active/);
  await expect(page.locator('li.item').filter({ hasText: 'Stub Title' }).locator('.editform')).toBeVisible();
});

test('SCN-007: edit address is validated and collisions are blocked', async ({ page }) => {
  await stubMetadata(page, 'ok');
  await ensureSignedIn(page);
  // add a second distinct bookmark to collide with
  await addBookmark(page, 'https://example.com/unique-page');
  const item = page.locator('li.item').filter({ hasText: 'example.com/unique-page' }).first();
  await item.getByRole('button', { name: 'Edit' }).click();
  const form = item.locator('.editform');
  // invalid address
  await form.locator('input[type="url"]').fill('abc');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form.locator('.msg.warn')).toContainText("doesn’t look like a web link");
  // collide with the flexbox bookmark's address
  await form.locator('input[type="url"]').fill('https://developer.mozilla.org/en-US/docs/Web/CSS/Flexbox');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form.locator('.msg.warn')).toContainText('already uses this address');
});

test('SCN-012: delete asks for confirmation', async ({ page }) => {
  await ensureSignedIn(page);
  const before = await page.locator('li.item').count();
  const item = page.locator('li.item').filter({ hasText: 'example.com/unique-page' }).first();
  await item.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#overlay')).toBeVisible();
  await page.click('#confirmCancel');
  await expect(page.locator('li.item')).toHaveCount(before);
  await item.getByRole('button', { name: 'Delete' }).click();
  await page.click('#confirmOk');
  await expect(page.locator('li.item').filter({ hasText: 'example.com/unique-page' })).toHaveCount(0);
});

test('SCN-013: sign out returns to sign-in; data persists on sign back in', async ({ page }) => {
  await ensureSignedIn(page);
  await page.click('#signout');
  await expect(page.locator('#signin')).toBeVisible();
  await page.fill('#email', ACCOUNT.email);
  await page.fill('#password', ACCOUNT.password);
  await page.click('#authSubmit');
  await expect(page.locator('#app')).toBeVisible();
  // bookmarks saved earlier are still there (search spans both tabs)
  await page.fill('#search', 'Stub');
  await expect(page.locator('li.item').filter({ hasText: 'Stub Title' })).toHaveCount(1);
});
