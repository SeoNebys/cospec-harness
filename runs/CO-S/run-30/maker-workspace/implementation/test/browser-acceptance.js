import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../server.js';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const directory = await mkdtemp(join(tmpdir(), 'bookmark-browser-'));
let articleRevision = 0;
const longTitle = 'A comprehensive field guide to inclusive digital products for many different people, devices, environments, languages, preferences, and assistive technologies';
const longDescription = `This complete article covers research, content, interaction patterns, testing, and accessibility guidance. ${'Further detailed guidance for thoughtful teams. '.repeat(18)}`;
const fixture = createServer((request, response) => {
  let title = 'Cooking Guide';
  let description = 'A practical guide to making excellent weeknight meals.';
  if (request.url.startsWith('/article')) {
    if ((request.headers['user-agent'] ?? '').startsWith('PersonalBookmarkLibrary/')) articleRevision += 1;
    title = `Controlled Accessibility Guide v${articleRevision}`;
    description = 'A detailed guide to accessible and interactive product design.';
  }
  if (request.url.startsWith('/long')) {
    title = longTitle;
    description = longDescription;
  }
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(`<!doctype html><title>${title}</title><meta name="description" content="${description}">`);
});

await listen(fixture);
const fixtureOrigin = `http://127.0.0.1:${fixture.address().port}`;
const app = await startServer({ port: 0, host: '127.0.0.1', dataFile: join(directory, 'bookmarks.json') });
const appOrigin = `http://127.0.0.1:${app.address().port}`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  await page.goto(appOrigin, { waitUntil: 'networkidle' });
  await page.locator('[data-harness-ready="true"]').waitFor();
  expect(await page.getByText('Your library is ready').isVisible(), 'SCN-001 empty state');

  await page.locator('#url').fill('not-a-link');
  await page.locator('#save-button').click();
  expect(await page.locator('#url-error').isVisible(), 'SCN-009 malformed address message');
  expect(await page.locator('.bookmark-item').count() === 0, 'SCN-009 malformed address changed library');

  const articleUrl = `${fixtureOrigin}/article`;
  await page.locator('#url').fill(articleUrl);
  await page.locator('#initial-label').fill('learning');
  await page.locator('#save-button').click();
  await page.getByRole('heading', { name: 'Controlled Accessibility Guide v1' }).waitFor();
  expect(await page.getByText('A detailed guide to accessible and interactive product design.').isVisible(), 'SCN-001 missing description');
  expect(await page.getByText('Read later', { exact: true }).isVisible(), 'SCN-007 initial status');

  const popupPromise = page.waitForEvent('popup');
  await page.locator('.card-link').click();
  const popup = await popupPromise;
  expect(popup.url() === articleUrl, 'SCN-003 wrong external destination');
  await popup.close();

  await page.locator('.label-editor input').fill('Reference');
  await page.locator('.label-editor button').click();
  await page.waitForFunction(() => document.querySelectorAll('.tag').length === 2);
  await page.locator('.label-editor input').fill('reference');
  await page.locator('.label-editor button').click();
  await page.locator('.label-feedback:not([hidden])').waitFor();
  expect(await page.locator('.tag').count() === 2, 'SCN-012 duplicate label chip');

  await page.locator('#url').fill(`${fixtureOrigin}/cooking`);
  await page.locator('#initial-label').fill('cooking');
  await page.locator('#save-button').click();
  await page.getByRole('heading', { name: 'Cooking Guide' }).waitFor();

  await page.locator('#search').fill('GUIDE');
  expect(await page.locator('.bookmark-item').count() === 2, 'SCN-006 case-insensitive search');
  await page.getByRole('button', { name: 'learning', exact: true }).click();
  expect(await page.locator('.bookmark-item').count() === 1, 'SCN-005/006 combined label and search');
  expect(await page.getByRole('heading', { name: 'Controlled Accessibility Guide v1' }).isVisible(), 'SCN-005 wrong label result');
  await page.locator('#search').fill('astronomy');
  expect(await page.getByText('No bookmarks found').isVisible(), 'SCN-011 no-results explanation');
  expect(await page.locator('#search').inputValue() === 'astronomy', 'SCN-011 search term lost');
  await page.locator('#clear-search').click();
  await page.getByRole('button', { name: 'All labels', exact: true }).click();

  const articleItem = page.locator('.bookmark-item').filter({ hasText: 'Controlled Accessibility Guide' });
  await articleItem.getByRole('button', { name: 'Mark as read' }).click();
  await page.locator('.bookmark-item').filter({ hasText: 'Controlled Accessibility Guide' }).locator('.status.read').waitFor();
  await page.locator('.bookmark-item').filter({ hasText: 'Controlled Accessibility Guide' }).getByRole('button', { name: 'Mark unread' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.bookmark-item')].find((item) => item.textContent.includes('Controlled Accessibility Guide'))?.querySelector('.status')?.textContent === 'Read later');

  await page.locator('#url').fill(articleUrl);
  await page.locator('#save-button').click();
  await page.locator('#duplicate-notice:not([hidden])').waitFor();
  expect(await page.locator('.bookmark-item').count() === 2, 'SCN-002 duplicate inserted');
  await page.getByRole('button', { name: 'Update bookmark' }).click();
  await page.getByRole('heading', { name: 'Controlled Accessibility Guide v2' }).waitFor();

  await page.locator('.bookmark-item').filter({ hasText: 'Controlled Accessibility Guide' }).getByRole('button', { name: 'Archive' }).click();
  await page.getByText('Bookmark archived. It is out of your main library, not deleted.').waitFor();
  await page.locator('#url').fill(articleUrl);
  await page.locator('#save-button').click();
  await page.locator('#duplicate-notice:not([hidden])').waitFor();
  expect(await page.getByText('This link is in your archive').isVisible(), 'SCN-014 archived duplicate not recognized');
  await page.getByRole('button', { name: 'Restore bookmark' }).click();
  await page.getByRole('heading', { name: 'Controlled Accessibility Guide v3' }).waitFor();
  expect(await page.locator('.bookmark-item').count() === 2, 'SCN-014 restore duplicated record');

  await page.locator('.bookmark-item').filter({ hasText: 'Controlled Accessibility Guide' }).getByRole('button', { name: 'Archive' }).click();
  await page.locator('[data-view="archive"]').click();
  const archived = page.locator('.bookmark-item').filter({ hasText: 'Controlled Accessibility Guide' });
  await archived.waitFor();
  expect(await archived.locator('.tag').count() === 2, 'SCN-008 archive lost labels');
  await archived.getByRole('button', { name: 'Restore' }).click();
  await page.getByText('Bookmark restored. It is back in your main library.').waitFor();

  await page.locator('[data-view="library"]').click();
  await page.locator('#url').fill(`${fixtureOrigin}/long`);
  await page.locator('#initial-label').fill('research');
  await page.locator('#save-button').click();
  const longItem = page.locator('.bookmark-item').filter({ hasText: 'comprehensive field guide' });
  await longItem.waitFor();
  for (const label of ['design', 'accessibility', 'long-term reading']) {
    await longItem.locator('.label-editor input').fill(label);
    await longItem.locator('.label-editor button').click();
    await page.waitForFunction((expected) => [...document.querySelectorAll('.bookmark-item')].find((item) => item.textContent.includes('comprehensive field guide'))?.querySelectorAll('.tag').length === expected, 1 + ['design', 'accessibility', 'long-term reading'].indexOf(label) + 1);
  }
  const cardHeight = await page.locator('.bookmark-item').filter({ hasText: 'comprehensive field guide' }).locator('.bookmark-card').evaluate((element) => element.getBoundingClientRect().height);
  expect(cardHeight < 300, 'SCN-015 long card is not compact');
  await page.locator('#search').fill('THOUGHTFUL');
  expect(await page.locator('.bookmark-item').count() === 1, 'SCN-015 complete description is not searchable');
  expect(await page.locator('.bookmark-item .tag').count() === 4, 'SCN-015 labels were lost');

  await page.locator('#search').fill('');
  await page.locator('#url').fill('http://127.0.0.1:1/unavailable');
  await page.locator('#initial-label').fill('research');
  await page.locator('#save-button').click();
  await page.locator('.inline-error').waitFor();
  expect(await page.locator('#url').inputValue() === 'http://127.0.0.1:1/unavailable', 'SCN-010 URL was lost');
  expect(await page.locator('#initial-label').inputValue() === 'research', 'SCN-010 label was lost');
  expect(await page.locator('#save-button').innerText() === 'Try again', 'SCN-010 retry missing');

  console.log('All browser acceptance scenarios passed.');
} finally {
  await browser.close();
  await close(app);
  await close(fixture);
  await rm(directory, { recursive: true, force: true });
}
