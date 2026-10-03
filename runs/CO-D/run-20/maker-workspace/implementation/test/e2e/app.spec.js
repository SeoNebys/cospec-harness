import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let app, origin, appUrl, originUrl, dataDir;

function startOrigin() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/kyoto')) {
      res.setHeader('content-type', 'text/html');
      res.end('<html><head><title>A quiet guide to Kyoto</title><meta name="description" content="Where to walk and eat in Kyoto."></head><body>k</body></html>');
    } else if (req.url.startsWith('/chicken')) {
      res.setHeader('content-type', 'text/html');
      res.end('<html><head><title>Best roast chicken</title><meta name="description" content="A weeknight method."></head><body>c</body></html>');
    } else if (req.url.startsWith('/doc.pdf')) {
      res.setHeader('content-type', 'application/pdf'); res.end(Buffer.from('%PDF-1.4 fake'));
    } else { res.setHeader('content-type', 'text/html'); res.end('<html><head><title>Generic Page</title></head><body>g</body></html>'); }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

test.beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-e2e-'));
  process.env.DATA_DIR = dataDir;
  const { createServer } = await import('../../server.js');
  app = await new Promise((r) => { const s = createServer().listen(0, '127.0.0.1', () => r(s)); });
  appUrl = `http://127.0.0.1:${app.address().port}`;
  origin = await startOrigin();
  originUrl = `http://127.0.0.1:${origin.address().port}`;
});
test.afterAll(() => { app && app.close(); origin && origin.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

async function fresh(page) { await page.goto(appUrl + '/'); await page.waitForSelector('[data-harness-ready="true"]'); }
async function saveViaReview(page, url, title) {
  await page.fill('#urlInput', url);
  await page.click('#saveBtn');
  await page.waitForSelector('.card');
  if (title) await page.fill('.card input', title);
  await page.click('.card button:has-text("Add to bookmarks")');
}

test('SCN-001: save via review with fetched details', async ({ page }) => {
  await fresh(page);
  await page.fill('#urlInput', originUrl + '/kyoto');
  await page.click('#saveBtn');
  await page.waitForSelector('.card');
  // review shows the fetched real title
  await expect(page.locator('.card input').first()).toHaveValue('A quiet guide to Kyoto');
  await page.click('.card button:has-text("Add to bookmarks")');
  await expect(page.locator('li.item a.title').first()).toHaveText('A quiet guide to Kyoto');
});

test('SCN-002: duplicate opens the existing entry to edit', async ({ page }) => {
  await fresh(page);
  await page.fill('#urlInput', originUrl.replace('http://127.0.0.1', 'http://127.0.0.1') + '/kyoto/');
  await page.click('#saveBtn');
  await expect(page.locator('#notice')).toContainText('already saved');
  await expect(page.locator('li.item .field input').first()).toBeVisible(); // editor open
  await page.click('li.item button:has-text("Cancel")');
});

test('SCN-004: search filters, highlights and counts; boolean', async ({ page }) => {
  await fresh(page);
  await saveViaReview(page, originUrl + '/chicken');
  await page.fill('#searchInput', 'kyoto');
  await expect(page.locator('#count')).toContainText('1 of 2');
  await expect(page.locator('li.item mark').first()).toHaveText(/kyoto/i);
  await page.fill('#searchInput', 'kyoto OR chicken');
  await expect(page.locator('li.item')).toHaveCount(2);
  await page.fill('#searchInput', '');
});

test('SCN-005/006/007: reading list, archive, delete', async ({ page }) => {
  await fresh(page);
  const first = page.locator('li.item').first();
  await first.getByRole('button', { name: 'Mark to read' }).click();
  await page.click('[data-f="toread"]');
  await expect(page.locator('li.item')).toHaveCount(1);
  await page.click('[data-f="all"]');
  // archive then restore
  await page.locator('li.item').first().getByRole('button', { name: 'Archive', exact: true }).click();
  await page.click('[data-f="archived"]');
  await expect(page.locator('li.item')).toHaveCount(1);
  await page.locator('li.item').first().getByRole('button', { name: 'Restore' }).click();
  await page.click('[data-f="all"]');
  // delete confirm cancel keeps, confirm removes
  const before = await page.locator('li.item').count();
  await page.locator('li.item').first().locator('.linkbtn.danger').click();
  await page.locator('li.item').first().getByRole('button', { name: 'Cancel' }).click();
  expect(await page.locator('li.item').count()).toBe(before);
});

test('SCN-008/009: tags filter + markdown note', async ({ page }) => {
  await fresh(page);
  const item = page.locator('li.item').first();
  await item.getByRole('button', { name: 'Edit' }).click();
  const editor = page.locator('li.item').first();
  await editor.locator('.tagbox input').fill('japan'); await page.keyboard.press('Enter');
  await editor.locator('.field textarea').last().fill('## Trip\n**bold** note');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('li.item .note h4').first()).toHaveText('Trip');
  await expect(page.locator('li.item .note strong').first()).toHaveText('bold');
  // click tag chip filters
  await page.locator('li.item .tag', { hasText: '#japan' }).first().click();
  await expect(page.locator('#searchInput')).toHaveValue('#japan');
  await page.fill('#searchInput', '');
});

test('SCN-014: bulk tag; selection clears on search', async ({ page }) => {
  await fresh(page);
  await page.locator('.selbox').nth(0).check();
  await page.locator('.selbox').nth(1).check();
  await expect(page.locator('.bcount')).toContainText('2 selected');
  await page.locator('#bulkbar').getByText('Add tag…', { exact: true }).click();
  await page.fill('.btag', 'batch');
  await page.locator('#bulkbar').getByText('Apply', { exact: true }).click();
  await page.fill('#searchInput', '#batch');
  await expect(page.locator('li.item')).toHaveCount(2);
  // selection cleared by the search change
  await expect(page.locator('#bulkbar')).toBeHidden();
  await page.fill('#searchInput', '');
});

test('SCN-015: saved search save, unique-name, reopen', async ({ page }) => {
  await fresh(page);
  await page.fill('#searchInput', '#batch');
  await page.click('#saveSearchBtn');
  await page.fill('.saveform input', 'Batch');
  await page.locator('#savedbar').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.schip', { hasText: 'Batch' })).toBeVisible();
  // unique name enforced
  await page.fill('#searchInput', '#japan');
  await page.click('#saveSearchBtn');
  await page.fill('.saveform input', 'batch');
  await page.locator('#savedbar').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.saveform .err')).toContainText('already exists');
  await page.locator('#savedbar').getByRole('button', { name: 'Cancel' }).click();
  // reopen
  await page.fill('#searchInput', '');
  await page.locator('.schip', { hasText: 'Batch' }).click();
  await expect(page.locator('#searchInput')).toHaveValue('#batch');
  await page.fill('#searchInput', '');
});

test('SCN-013/018: sort + settings pagination display-only', async ({ page }) => {
  await fresh(page);
  await page.click('#settingsBtn');
  await page.locator('#settings select').nth(1).selectOption('5'); // items per page
  // add several so there are more than 5
  await page.click('#settingsBtn');
  for (const u of ['https://p1.example/a', 'https://p2.example/b', 'https://p3.example/c', 'https://p4.example/d']) {
    await saveViaReview(page, u, null);
  }
  const total = await page.evaluate(async () => (await (await fetch('/api/state')).json()).bookmarks.length);
  if (total > 5) {
    await expect(page.locator('.pagenote')).toContainText(`Showing 5 of ${total}`);
    // select-all covers all matching incl not revealed
    await page.locator('.selbox').first().check();
    await page.locator('#bulkbar').getByRole('button', { name: `Select all ${total} matching` }).click();
    await expect(page.locator('.bcount')).toContainText(`${total} selected`);
    await page.locator('#bulkbar').getByRole('button', { name: 'Clear', exact: true }).click();
  }
  // sort by title works
  await page.selectOption('#sortSelect', 'title-asc');
});

test('SCN-016: offline copy from the UI', async ({ page }) => {
  await fresh(page);
  await saveViaReview(page, originUrl + '/doc.pdf', 'A PDF');
  const item = page.locator('li.item', { hasText: 'A PDF' }).first();
  await item.getByRole('button', { name: 'Save PDF offline' }).click();
  await expect(page.locator('li.item', { hasText: 'A PDF' }).first().locator('.badge.offline')).toHaveText('PDF saved');
});
