// Browser acceptance tests for the client-side behaviours (SCN-003 tag browsing +
// suggestions, SCN-004 search, and the interactive read-later/archive/edit/delete
// flows). Uses the shared Chromium via PLAYWRIGHT_BROWSERS_PATH.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/playwright-browsers';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { Store } from '../store.js';
import { createApp } from '../server.js';

let server, base, dataFile, browser, page;

before(async () => {
  dataFile = join(tmpdir(), 'bm-ui-' + randomUUID() + '.json');
  const store = new Store(dataFile);
  const A = store.add({ url: 'https://en.wikipedia.org/wiki/Bookmark', title: 'Bookmark - Wikipedia', tags: ['reading', 'reference'] });
  const B = store.add({ url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', title: 'JavaScript | MDN', tags: ['work', 'reference'] });
  store.add({ url: 'https://news.ycombinator.com', title: 'Hacker News', tags: ['reading', 'work'] });
  const D = store.add({ url: 'https://www.seriouseats.com/the-food-lab', title: 'The Food Lab', tags: ['recipes'] });
  store.update(B.id, { toRead: true });
  store.update(D.id, { archived: true });

  const app = createApp({ store, titleFetcher: async (url) => 'Title of ' + url });
  await new Promise((res) => { server = app.listen(0, res); });
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.goto(base);
  await page.waitForSelector('body[data-harness-ready="true"]');
});
after(async () => { await browser?.close(); server.close(); rmSync(dataFile, { force: true }); });

const visibleTitles = () => page.$$eval('#list .item .title', (els) => els.map((e) => e.textContent.trim()));

test('SCN-004: search filters, highlights, and shows a friendly no-match state', async () => {
  await page.fill('#searchInput', 'java');
  await page.waitForFunction(() => document.querySelectorAll('#list .item').length === 1);
  assert.deepEqual(await visibleTitles(), ['JavaScript | MDN']);
  assert.equal(await page.locator('#list .item mark').first().textContent(), 'Java');
  assert.match(await page.textContent('#sectionLabel'), /Results for/);

  await page.fill('#searchInput', 'zzz');
  await page.waitForSelector('#empty:not([hidden])');
  assert.match(await page.textContent('#emptyBig'), /No matches/);

  await page.click('#searchClear');
  await page.waitForFunction(() => document.querySelectorAll('#list .item').length === 3); // 3 non-archived
});

test('SCN-003: browse by a tag from the Browse row', async () => {
  await page.click('#tagbar button:has-text("#work")');
  await page.waitForFunction(() => document.querySelectorAll('#list .item').length === 2);
  const titles = await visibleTitles();
  assert.ok(titles.includes('JavaScript | MDN') && titles.includes('Hacker News'));
  assert.match(await page.textContent('#sectionLabel'), /#work/);
  await page.click('#tagbar button:has-text("All")');
  await page.waitForFunction(() => document.querySelectorAll('#list .item').length === 3);
});

test('SCN-003: existing tags are suggested while typing', async () => {
  await page.fill('#tagInput', 're');
  await page.waitForSelector('#saveSuggest.open');
  const opts = await page.$$eval('#saveSuggest .opt', (els) => els.map((e) => e.textContent));
  assert.ok(opts.some((o) => o.includes('reading')));
  assert.ok(opts.some((o) => o.includes('reference')));
  await page.fill('#tagInput', '');
});

test('SCN-005: reading queue shows only flagged links; mark read removes it', async () => {
  await page.click('#tabs button[data-view="toread"]');
  await page.waitForFunction(() => document.querySelectorAll('#list .item').length === 1);
  assert.deepEqual(await visibleTitles(), ['JavaScript | MDN']);
  await page.click('#list .item .markread');
  await page.waitForSelector('#empty:not([hidden])');
  assert.match(await page.textContent('#emptyBig'), /reading queue is empty/);
  await page.click('#tabs button[data-view="all"]');
  await page.waitForFunction(() => document.querySelectorAll('#list .item').length === 3);
});

test('SCN-006: archived links live only in the Archived tab and can be restored', async () => {
  await page.click('#tabs button[data-view="archive"]');
  await page.waitForFunction(() => document.querySelectorAll('#list .item').length === 1);
  assert.deepEqual(await visibleTitles(), ['The Food Lab']);
  await page.click('#list .item .restorebtn');
  await page.waitForSelector('#empty:not([hidden])');
  await page.click('#tabs button[data-view="all"]');
  await page.waitForFunction(() => document.querySelectorAll('#list .item').length === 4);
});

test('SCN-002: edit a bookmark title via the pencil form', async () => {
  await page.click('#list .item:has-text("Hacker News") .pencil');
  await page.waitForSelector('#list .editform');
  await page.fill('#list .editform .ftitle', 'HN Front Page');
  await page.click('#list .editform .save');
  await page.waitForFunction(() => [...document.querySelectorAll('#list .item .title')].some((e) => e.textContent.trim() === 'HN Front Page'));
});

test('SCN-008: invalid input blocked; duplicate surfaced', async () => {
  await page.fill('#urlInput', 'not a url');
  await page.click('#saveBtn');
  await page.waitForSelector('#saveMsg.err');
  assert.match(await page.textContent('#saveMsg'), /web address/);

  await page.fill('#urlInput', 'https://news.ycombinator.com');
  await page.click('#saveBtn');
  await page.waitForSelector('#saveMsg.info');
  assert.match(await page.textContent('#saveMsg'), /already saved/);
  await page.fill('#urlInput', '');
});

test('SCN-007: delete asks for confirmation, then removes the bookmark', async () => {
  const before = (await visibleTitles()).length;
  await page.click('#list .item:has-text("HN Front Page") .pencil');
  await page.waitForSelector('#list .editform');
  await page.click('#list .editform .delete');
  await page.waitForSelector('#delOverlay:not([hidden])');
  assert.match(await page.textContent('#delTarget'), /HN Front Page/);
  await page.click('#delConfirm');
  await page.waitForFunction((n) => document.querySelectorAll('#list .item').length === n, before - 1);
  assert.ok(!(await visibleTitles()).includes('HN Front Page'));
});

test('SCN-001: saving a new link shows it immediately then the real title fills in', async () => {
  await page.fill('#urlInput', 'https://example.com/new-article');
  await page.click('#saveBtn');
  // Optimistic placeholder appears immediately at the top.
  await page.waitForSelector('#list .item .title.fetching');
  // Server responds with the (fake) fetched title.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('#list .item .title')].some((e) => e.textContent.includes('Title of https://example.com/new-article')));
});
