const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { createBookmarkServer } = require('../src/server');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('the approved daily loop works through the browser', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trove-browser-'));
  const pages = http.createServer((request, response) => {
    const focus = request.url.startsWith('/focus');
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<html><head>
      <title>${focus ? 'How to focus on meaningful work' : 'Designing for understanding'}</title>
      <meta name="description" content="${focus ? 'A guide to protecting attention for deep work.' : 'Make complex interfaces easier to understand.'}">
    </head></html>`);
  });
  const pagesPort = await listen(pages);
  const { server } = createBookmarkServer({ dbPath: path.join(tempDir, 'bookmarks.db') });
  const appPort = await listen(server);

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/playwright-browsers/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell'
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  t.after(async () => {
    await browser.close();
    if (server.listening) await close(server);
    if (pages.listening) await close(pages);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${appPort}`;
  const firstUrl = `http://127.0.0.1:${pagesPort}/article`;
  const secondUrl = `http://127.0.0.1:${pagesPort}/focus`;

  await page.goto(base);
  await page.waitForSelector('[data-harness-ready="true"]');
  await page.getByText('Your collection is empty. Save a web address above whenever you’re ready.').waitFor();

  await page.locator('#save-url').fill('not a web address');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await page.getByText('Enter a complete web address, such as https://example.com').waitFor();

  await page.locator('#save-url').fill(firstUrl);
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await page.getByRole('link', { name: 'Designing for understanding' }).waitFor();
  assert.equal(await page.locator('.bookmark-card').count(), 1);

  await page.locator('#save-url').fill(`${firstUrl}?utm_source=newsletter#details`);
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await page.getByText('Already saved — showing your existing bookmark.').waitFor();
  assert.equal(await page.locator('.bookmark-card').count(), 1);

  await page.getByRole('button', { name: 'Edit existing' }).click();
  await page.locator('#edit-title').fill('Designing for understanding — reference');
  await page.locator('#edit-tags').fill('Design, Reference, Knowledge, UX, Reading, Methods');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('link', { name: 'Designing for understanding — reference' }).waitFor();
  const editedCard = page.getByRole('link', { name: 'Designing for understanding — reference' }).locator('xpath=ancestor::article');
  assert.equal(await editedCard.locator('.tag-button').count(), 4);
  assert.equal(await editedCard.locator('.more-tags').innerText(), '+2 more tags');
  assert.equal(await editedCard.locator('.card-title').evaluate((node) => getComputedStyle(node).webkitLineClamp), '2');
  assert.equal(await editedCard.locator('.card-description').evaluate((node) => getComputedStyle(node).webkitLineClamp), '2');
  await page.getByRole('button', { name: 'Design' }).click();
  assert.equal(await page.locator('.bookmark-card').count(), 1);
  await page.locator('#clear-tag').click();

  await page.locator('#search').fill('REFERENCE');
  assert.equal(await page.locator('.bookmark-card').count(), 1);
  await page.locator('#search').fill('volcanoes');
  await page.getByText(/No saved pages match that search/).waitFor();
  await page.locator('#search').fill('');

  await page.getByRole('button', { name: '+ Read later' }).click();
  await page.waitForFunction(() => document.querySelector('#later-count')?.textContent === '1');
  assert.equal(await page.locator('#later-count').innerText(), '1');
  await page.getByRole('button', { name: /Read later/ }).click();
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await page.getByText('Nothing waiting to be read. Pages you set aside will appear here.').waitFor();
  await page.getByRole('button', { name: 'All bookmarks' }).click();

  await page.locator('#save-url').fill(secondUrl);
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await page.getByRole('link', { name: 'How to focus on meaningful work' }).waitFor();
  await page.locator('#search').fill('FOCUS');
  assert.equal(await page.locator('.bookmark-card').count(), 1);
  await page.reload();
  await page.waitForSelector('[data-harness-ready="true"]');
  assert.equal(await page.locator('#search').inputValue(), '');
  assert.equal(await page.locator('.bookmark-card').count(), 2);

  const focusCard = page.getByRole('link', { name: 'How to focus on meaningful work' }).locator('xpath=ancestor::article');
  await focusCard.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#edit-url').fill(firstUrl);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('That page is already saved as “Designing for understanding — reference.”').waitFor();
  await page.getByRole('button', { name: 'Cancel' }).click();

  const designCard = page.getByRole('link', { name: 'Designing for understanding — reference' }).locator('xpath=ancestor::article');
  await designCard.getByRole('button', { name: 'Delete' }).click();
  await designCard.getByRole('button', { name: 'Delete bookmark' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.bookmark-card').length === 1);
  assert.equal(await page.locator('.bookmark-card').count(), 1);

  const remaining = page.getByRole('link', { name: 'How to focus on meaningful work' }).locator('xpath=ancestor::article');
  await remaining.getByRole('button', { name: 'Delete' }).click();
  await remaining.getByRole('button', { name: 'Delete bookmark' }).click();
  await page.getByText('Your collection is empty. Save a web address above whenever you’re ready.').waitFor();
  assert.equal(await page.locator('#result-count').innerText(), '0 bookmarks');
  assert.equal(await page.locator('#save-url').evaluate((node) => node === document.activeElement), true);
});
