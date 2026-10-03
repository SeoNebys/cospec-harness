const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const appPort = 4310;
const sourcePort = 4311;
const root = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'keepwell-e2e-'));
const dataFile = path.join(temporary, 'bookmarks.json');

function waitForServer(url, timeout = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => http.get(url, response => { response.resume(); resolve(); }).on('error', () => {
      if (Date.now() - started > timeout) reject(new Error(`Timed out waiting for ${url}`));
      else setTimeout(attempt, 100);
    });
    attempt();
  });
}

async function api(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${appPort}${pathname}`, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(payload.message), { response, payload });
  return payload;
}

const source = http.createServer((request, response) => {
  if (request.url === '/unavailable') {
    response.writeHead(503, { 'content-type': 'text/plain' }); response.end('Unavailable'); return;
  }
  const pages = {
    '/food-lab': ['The Food Lab: Better Home Cooking Through Science', 'Explore practical cooking techniques and the science behind better results.'],
    '/pasta': ['Quick Tomato Pasta for Weeknights', 'A simple pantry pasta with a bright tomato sauce.'],
    '/contrast': ['A practical guide to color contrast', 'How to choose readable color combinations for interface design.']
  };
  const [title, description] = pages[request.url] || ['Test page', 'A test page description.'];
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><title>${title}</title><meta name="description" content="${description}"><h1>${title}</h1>`);
});

let app;
let browser;

(async () => {
  source.listen(sourcePort, '127.0.0.1');
  app = spawn(process.execPath, ['implementation/server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(appPort), KEEPWELL_DATA_FILE: dataFile, KEEPWELL_ALLOW_PRIVATE: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  app.stderr.on('data', chunk => process.stderr.write(chunk));
  await waitForServer(`http://127.0.0.1:${appPort}/api/state`);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${appPort}`, { waitUntil: 'networkidle' });
  await page.locator('[data-harness-ready="true"]').waitFor();

  // SCN-001 / SCN-008: empty library, invalid input, and recognizable metadata.
  await assert.doesNotReject(async () => assert.equal(await page.locator('#empty-title').innerText(), 'No bookmarks yet'));
  await page.locator('#url-input').fill('not-an-address');
  await page.locator('#save-button').click();
  await page.locator('.feedback-error').waitFor();
  assert.equal(await page.locator('#url-input').inputValue(), 'not-an-address');
  await page.locator('#url-input').fill(`http://127.0.0.1:${sourcePort}/food-lab`);
  await page.locator('#save-button').click();
  await page.getByText('Bookmark saved with page details').waitFor();
  assert.equal(await page.locator('.bookmark-card').count(), 1);
  assert.match(await page.locator('.bookmark-card').innerText(), /Food Lab/);

  // SCN-002 / SCN-012: inline details and required title.
  await page.getByRole('button', { name: 'Edit details' }).click();
  await page.locator('[data-form="details"] [name="title"]').fill('');
  await page.locator('[data-form="details"]').getByRole('button', { name: 'Save changes' }).click();
  await page.locator('[data-form="details"] .field-error').waitFor();
  await page.locator('[data-form="details"] [name="title"]').fill('The Food Lab — my cooking reference');
  await page.locator('[data-form="details"] [name="description"]').fill('My go-to guide for learning why recipes work.');
  await page.locator('[data-form="details"]').getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Bookmark details updated').waitFor();

  // Create two more recognizable bookmarks.
  for (const route of ['pasta', 'contrast']) {
    await page.locator('#url-input').fill(`http://127.0.0.1:${sourcePort}/${route}`);
    await page.locator('#save-button').click();
    await page.getByText('Bookmark saved with page details').waitFor();
  }

  let snapshot = await api('/api/state');
  const food = snapshot.bookmarks.find(bookmark => bookmark.title.includes('Food Lab'));
  const pasta = snapshot.bookmarks.find(bookmark => bookmark.title.includes('Pasta'));
  const contrast = snapshot.bookmarks.find(bookmark => bookmark.title.includes('contrast'));
  await api(`/api/bookmarks/${pasta.id}`, { method: 'PATCH', body: JSON.stringify({ tags: ['Recipes'] }) });
  await api(`/api/bookmarks/${contrast.id}`, { method: 'PATCH', body: JSON.stringify({ tags: ['Design', 'Research'] }) });
  await page.reload({ waitUntil: 'networkidle' });

  // SCN-003 / SCN-009 / SCN-004: reuse and create tags, then browse by tag.
  const foodCard = page.locator(`[data-bookmark-id="${food.id}"]`);
  await foodCard.getByRole('button', { name: 'Add tag' }).click();
  await foodCard.locator('[data-role="tag-input"]').fill('rec');
  const existingSuggestion = foodCard.getByRole('button', { name: /Recipes Used before/ });
  await existingSuggestion.waitFor(); await existingSuggestion.click();
  await foodCard.getByRole('button', { name: 'Add tag' }).click();
  await foodCard.locator('[data-role="tag-input"]').fill('travel');
  await foodCard.getByRole('button', { name: /Travel Create new tag/ }).click();
  await page.locator('#sidebar-tags').getByRole('button', { name: /Recipes 2/ }).click();
  assert.equal(await page.locator('.bookmark-card').count(), 2);
  assert.equal(await page.locator('#active-filter').innerText(), 'Recipes');

  // SCN-011 / SCN-005 / SCN-010: note, live search across fields, and clearing no results.
  await page.getByRole('button', { name: /All bookmarks/ }).click();
  await foodCard.getByRole('button', { name: 'Add note' }).click();
  await foodCard.locator('[name="note"]').fill('Try the fermentation chapter next.');
  await foodCard.getByRole('button', { name: 'Save note' }).click();
  await page.getByText('Note saved and searchable').waitFor();
  await page.locator('#search-input').fill('fermentation');
  assert.equal(await page.locator('.bookmark-card').count(), 1);
  assert.match(await page.locator('.note-match').innerText(), /Matched in your note/);
  await page.locator('#search-input').fill('weeknights');
  assert.match(await page.locator('.bookmark-title').innerText(), /Weeknights/);
  await page.locator('#search-input').fill('readable');
  assert.match(await page.locator('.bookmark-title').innerText(), /contrast/);
  await page.locator('#search-input').fill('astronomy');
  assert.equal(await page.locator('#empty-title').innerText(), 'No bookmarks match that search');
  await page.locator('#clear-search').click();
  assert.equal(await page.locator('.bookmark-card').count(), 3);

  // SCN-006: mark, review, complete, and retain.
  await foodCard.getByRole('button', { name: 'Read later' }).click();
  await page.waitForFunction(() => document.querySelector('#later-count')?.textContent === '1');
  assert.equal(await page.locator('#later-count').innerText(), '1');
  await page.getByRole('button', { name: /Read later 1/ }).click();
  assert.equal(await page.locator('.bookmark-card').count(), 1);
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await page.waitForFunction(() => document.querySelector('#later-count')?.textContent === '0');
  assert.equal(await page.locator('#later-count').innerText(), '0');
  assert.equal(await page.locator('#empty-title').innerText(), 'Nothing waiting here');
  await page.getByRole('button', { name: /All bookmarks/ }).click();
  assert.equal(await page.locator('.bookmark-card').count(), 3);

  // SCN-007: the complete card opens the stored address in a new tab.
  const popupPromise = page.waitForEvent('popup');
  await foodCard.locator('.bookmark-main').click();
  const popup = await popupPromise;
  assert.match(popup.url(), /food-lab/);
  await popup.close();

  // SCN-008: duplicate and metadata recovery.
  await page.locator('#url-input').fill(`http://127.0.0.1:${sourcePort}/food-lab`);
  await page.locator('#save-button').click();
  await page.getByText('You already saved this page.').waitFor();
  await page.locator('#url-input').fill(`http://127.0.0.1:${sourcePort}/unavailable`);
  await page.locator('#save-button').click();
  await page.locator('#manual-form:visible').waitFor();
  await page.locator('#manual-title').fill('Unavailable but useful page');
  await page.locator('#manual-form').getByRole('button', { name: 'Save with my details' }).click();
  await page.getByText('Bookmark saved with your details').waitFor();

  // SCN-013 / SCN-014: compact long content, preserve all tags and saved data.
  const longTitle = 'A comprehensive guide '.repeat(10).trim();
  const manyTags = ['Design', 'Research', 'Accessibility', 'Reference', 'Work', 'Color theory'];
  await api(`/api/bookmarks/${contrast.id}`, { method: 'PATCH', body: JSON.stringify({ title: longTitle, description: 'A long description '.repeat(25), note: 'A long private note '.repeat(25), tags: manyTags }) });
  await page.reload({ waitUntil: 'networkidle' });
  const longCard = page.locator(`[data-bookmark-id="${contrast.id}"]`);
  await longCard.getByRole('button', { name: 'Show full bookmark' }).waitFor();
  assert.equal(await longCard.locator('.tag-chip').count(), manyTags.length);
  await longCard.getByRole('button', { name: 'Show full bookmark' }).click();
  assert.equal(await longCard.evaluate(element => element.classList.contains('is-expanded')), true);
  const preserved = (await api('/api/state')).bookmarks.find(bookmark => bookmark.id === contrast.id);
  assert.equal(preserved.title, longTitle);
  assert.equal(preserved.tags.length, manyTags.length);

  console.log('E2E acceptance checks passed for SCN-001 through SCN-014');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (app) app.kill('SIGTERM');
  await new Promise(resolve => source.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
});
