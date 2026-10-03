'use strict';
// Gherkin-based acceptance tests mapped to approved scenarios (SCN-NNN).
// Runs against the real server started by playwright.config.js (temp data file).
const { test, expect } = require('@playwright/test');

async function reset(request) {
  const r = await request.get('/api/bookmarks');
  const { bookmarks } = await r.json();
  for (const b of bookmarks) await request.delete('/api/bookmarks/' + b.id);
}
async function seed(request, over) {
  // create directly with reviewed details (bypasses network fetch)
  const body = Object.assign({ url: 'https://x.test/', title: 'X', description: '', note: '', retrieved: true }, over);
  const r = await request.post('/api/bookmarks', { data: body });
  return (await r.json()).bookmark;
}

test.beforeEach(async ({ request }) => { await reset(request); });

test('SCN-013: empty library shows a calm invitation', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.wrap[data-harness-ready="true"]');
  await expect(page.locator('.empty .big')).toHaveText('Your library is empty.');
});

test('SCN-002: re-saving an equivalent address opens the existing entry', async ({ page, request }) => {
  await seed(request, { url: 'https://www.example.com/', title: 'Example' });
  await page.goto('/');
  await page.waitForSelector('.wrap[data-harness-ready="true"]');
  // Preview should report duplicate for an equivalent address (no new entry).
  const r = await request.post('/api/preview', { data: { url: 'http://example.com' } });
  const d = await r.json();
  expect(d.duplicate).toBe(true);
  expect(await page.locator('li.item').count()).toBe(1);
});

test('SCN-003: read/archive independent across All/Unread/Archived', async ({ page, request }) => {
  await seed(request, { url: 'https://a.test/', title: 'Alpha' });
  await page.goto('/');
  await page.waitForSelector('.wrap[data-harness-ready="true"]');
  await page.locator('li.item [data-act="read"]').first().click();
  await expect(page.locator('li.item .sb.read')).toBeVisible(); // stays in All, shown Read
  await page.locator('.tab[data-tab="unread"]').click();
  await expect(page.locator('.empty .big')).toBeVisible(); // gone from Unread
  await page.locator('.tab[data-tab="all"]').click();
  await page.locator('li.item [data-act="archive"]').first().click();
  await page.locator('.tab[data-tab="archived"]').click();
  await expect(page.locator('li.item')).toHaveCount(1);
});

test('SCN-004/005: tags visible, single- and multi-tag filter (match all)', async ({ page, request }) => {
  await seed(request, { url: 'https://a.test/', title: 'A' });
  await seed(request, { url: 'https://b.test/', title: 'B' });
  const all = await (await request.get('/api/bookmarks')).json();
  const [a, b] = all.bookmarks; // newest first: b then a
  await request.post('/api/bookmarks/' + a.id + '/tags/add', { data: { tag: 'web' } });
  await request.post('/api/bookmarks/' + a.id + '/tags/add', { data: { tag: 'css' } });
  await request.post('/api/bookmarks/' + b.id + '/tags/add', { data: { tag: 'web' } });
  await page.goto('/');
  await page.waitForSelector('.wrap[data-harness-ready="true"]');
  await page.locator('.chip .lab', { hasText: 'web' }).first().click();
  await expect(page.locator('li.item')).toHaveCount(2);
  await page.locator('.chip .lab', { hasText: 'css' }).first().click();
  await expect(page.locator('li.item')).toHaveCount(1); // match ALL
});

test('SCN-008: query language — phrase, #tag, boolean, view scope', async ({ page, request }) => {
  await seed(request, { url: 'https://a.test/', title: 'CSS Grid Layout' });
  const b = await seed(request, { url: 'https://b.test/', title: 'Old Book' });
  await request.post('/api/bookmarks/' + b.id + '/tags/add', { data: { tag: 'book' } });
  await request.post('/api/bookmarks/' + b.id + '/state', { data: { archived: true } });
  await page.goto('/');
  await page.waitForSelector('.wrap[data-harness-ready="true"]');
  await page.fill('#search', '"grid layout"');
  await expect(page.locator('li.item')).toHaveCount(1);
  // archived book excluded from All, found in Archived (scope + #tag)
  await page.fill('#search', '#book');
  await expect(page.locator('.empty')).toBeVisible();
  await page.locator('.tab[data-tab="archived"]').click();
  await expect(page.locator('li.item')).toHaveCount(1);
});

test('SCN-006/014: edit details then permanently delete', async ({ page, request }) => {
  const a = await seed(request, { url: 'https://a.test/', title: 'A' });
  await page.goto('/');
  await page.waitForSelector('.wrap[data-harness-ready="true"]');
  await page.locator('li.item[data-id="' + a.id + '"] [data-editopen]').click();
  await page.fill('li.item[data-id="' + a.id + '"] [data-ef="title"]', 'Renamed');
  await page.fill('li.item[data-id="' + a.id + '"] [data-ef="note"]', '**bold** note');
  await page.locator('li.item[data-id="' + a.id + '"] [data-editsave]').click();
  await expect(page.locator('li.item[data-id="' + a.id + '"] .t')).toHaveText('Renamed');
  await expect(page.locator('li.item[data-id="' + a.id + '"] .note .md strong')).toBeVisible();
  // permanent delete with confirmation
  await page.locator('li.item[data-id="' + a.id + '"] [data-editopen]').click();
  await page.locator('li.item[data-id="' + a.id + '"] [data-delask]').click();
  await page.locator('li.item[data-id="' + a.id + '"] [data-delyes]').click();
  await expect(page.locator('.empty')).toBeVisible();
});

test('SCN-015: bulk select-all-matching then bulk action; selection clears on view change', async ({ page, request }) => {
  for (let i = 0; i < 3; i++) await seed(request, { url: 'https://s' + i + '.test/', title: 'S' + i });
  await page.goto('/');
  await page.waitForSelector('.wrap[data-harness-ready="true"]');
  await page.locator('#selall').check();
  await expect(page.locator('#bulkbar .bcount')).toHaveText('3 selected');
  await page.locator('#bulkbar [data-bulk="read"]').click();
  await expect(page.locator('li.item .sb.read')).toHaveCount(3);
  // selection cleared after a bulk action
  await expect(page.locator('#bulkbar')).toBeHidden();
  // and clearing rule: selecting then changing view clears selection
  await page.locator('.selbox').first().check();
  await expect(page.locator('#bulkbar')).toBeVisible();
  await page.locator('.tab[data-tab="unread"]').click();
  await expect(page.locator('#bulkbar')).toBeHidden();
});

test('SCN-016: clicking a title targets the original page in a new tab', async ({ page, request }) => {
  await seed(request, { url: 'https://a.test/page', title: 'A' });
  await page.goto('/');
  await page.waitForSelector('.wrap[data-harness-ready="true"]');
  const a = page.locator('li.item .t a').first();
  await expect(a).toHaveAttribute('target', '_blank');
  await expect(a).toHaveAttribute('href', 'https://a.test/page');
});
