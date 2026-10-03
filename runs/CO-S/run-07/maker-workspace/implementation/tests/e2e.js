const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { BookmarkStore } = require('../src/store');
const { createApp } = require('../src/server');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pocketmark-e2e-'));
  const store = new BookmarkStore(path.join(directory, 'bookmarks.json'));
  const unavailable = new Error('No details');
  unavailable.code = 'DETAILS_UNAVAILABLE';
  const server = createApp({
    store,
    metadataFetcher: async (url) => {
      if (url.includes('private.example')) throw unavailable;
      if (url.includes('/second')) return { title: 'A second useful page', description: 'Another page for walking ideas.' };
      return { title: 'The quiet power of a daily walk', description: 'A daily walk can improve focus and wellbeing.' };
    },
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(base);
    await page.locator('[data-harness-ready="true"]').waitFor();
    await page.getByTestId('empty-library').waitFor();

    await page.getByRole('button', { name: 'Add a bookmark' }).click();
    await page.locator('#new-url').fill('bookmark');
    await page.getByRole('button', { name: 'Get details' }).click();
    await assert.rejects(async () => page.locator('#new-url-error').waitFor({ state: 'hidden', timeout: 100 }), /Timeout/);
    assert.match(await page.locator('#new-url-error').innerText(), /http:\/\//);

    await page.locator('#new-url').fill('https://example.com/walking');
    await page.getByRole('button', { name: 'Get details' }).click();
    await page.locator('#details-form').waitFor();
    assert.equal(await page.locator('#new-title').inputValue(), 'The quiet power of a daily walk');
    await page.locator('#new-tag-editor input').fill('Health');
    await page.locator('#new-tag-editor input').press('Enter');
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    await page.getByText('The quiet power of a daily walk', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);

    await page.getByRole('button', { name: '+ Add bookmark' }).click();
    await page.locator('#new-url').fill('https://example.com/second');
    await page.getByRole('button', { name: 'Get details' }).click();
    await page.locator('#new-tag-editor input').fill('hea');
    await page.getByRole('button', { name: /Health Existing tag/ }).click();
    await page.locator('#new-tag-editor input').fill('Walking');
    await page.locator('#new-tag-editor input').press('Enter');
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    const secondCard = page.getByTestId('bookmark-card').filter({ hasText: 'A second useful page' });
    await secondCard.waitFor();
    assert.deepEqual(await secondCard.locator('.tag-pill').allInnerTexts(), ['Health', 'Walking']);
    await secondCard.getByRole('button', { name: 'Remove' }).click();
    await secondCard.getByRole('button', { name: 'Remove bookmark' }).click();
    await secondCard.waitFor({ state: 'detached' });
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);

    const popupPromise = page.waitForEvent('popup');
    await page.getByTestId('bookmark-card').click({ position: { x: 300, y: 80 } });
    const popup = await popupPromise;
    assert.match(popup.url(), /^https:\/\/example\.com\/walking/);
    await popup.close();

    await page.getByRole('button', { name: 'Read later', exact: true }).click();
    await page.getByRole('button', { name: /Read later/ }).first().click();
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);
    await page.getByRole('button', { name: 'Saved for later ✓' }).click();
    await page.getByTestId('empty-later').waitFor();
    await page.getByRole('button', { name: 'Show all bookmarks' }).click();
    await page.getByRole('button', { name: 'Read later', exact: true }).click();

    await page.locator('#search').fill('QUIET');
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);
    await page.locator('#search').fill('example.com/walk');
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);
    await page.locator('#search').fill('heal');
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);
    await page.locator('#search').fill('focus');
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);
    await page.locator('#search').fill('volcano');
    await page.getByTestId('empty-search').waitFor();
    await page.getByRole('button', { name: 'Clear search' }).click();
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);

    await page.getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByTestId('edit-card');
    await edit.getByLabel('Title').fill('My corrected walking guide');
    await edit.getByLabel('Description').fill('A corrected summary with focus.');
    await edit.getByLabel('Web address').fill('https://example.com/walking-corrected');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('My corrected walking guide', { exact: true }).waitFor();

    await page.getByRole('button', { name: '+ Add bookmark' }).click();
    await page.locator('#new-url').fill('https://example.com/walking-corrected/');
    await page.getByRole('button', { name: 'Get details' }).click();
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    await page.locator('#duplicate-warning:not([hidden])').waitFor();
    await page.getByRole('button', { name: 'View existing bookmark' }).click();
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);

    await page.getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('button', { name: 'Keep bookmark' }).click();
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);
    await page.getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('button', { name: 'Remove bookmark' }).click();
    await page.getByTestId('empty-library').waitFor();

    await page.getByRole('button', { name: 'Add a bookmark' }).click();
    await page.locator('#new-url').fill('https://private.example/page');
    await page.getByRole('button', { name: 'Get details' }).click();
    await page.locator('#metadata-warning:not([hidden])').waitFor();
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    assert.match(await page.locator('#new-title-error').innerText(), /Enter a title/);
    await page.locator('#new-title').fill('My private reference');
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    await page.getByText('My private reference', { exact: true }).waitFor();

    await page.getByRole('button', { name: 'Edit' }).click();
    const invalidEdit = page.getByTestId('edit-card');
    await invalidEdit.getByLabel('Title').fill('');
    await invalidEdit.getByLabel('Web address').fill('walking');
    await invalidEdit.getByRole('button', { name: 'Save changes' }).click();
    assert.match(await invalidEdit.locator('.field-error').first().innerText(), /Enter a title/);
    assert.match(await invalidEdit.locator('.field-error').nth(1).innerText(), /http:\/\//);
    await invalidEdit.getByRole('button', { name: 'Cancel' }).click();
    await page.getByText('My private reference', { exact: true }).waitFor();

    store.create({
      url: 'https://long.example/resources/a-very-long-address-for-a-detailed-guide-to-walking',
      title: 'An exceptionally thorough guide to building a calmer healthier and more sustainable daily walking habit in busy cities',
      description: 'A detailed field guide with route planning ideas, weather preparation, reflective prompts, accessibility considerations, and evidence-informed suggestions for making a daily walk last throughout the year.',
      tags: ['Health', 'Walking', 'Reading', 'Habits', 'Research'],
    });
    for (let index = 0; index < 13; index += 1) {
      store.create({ url: `https://bulk.example/item-${index}`, title: `Bulk bookmark ${index}`, description: 'A saved item used to exercise the large library.', tags: index % 2 ? ['Ideas'] : [] });
    }
    const privateBookmark = store.list().find((bookmark) => bookmark.title === 'My private reference');
    privateBookmark.createdAt = '2025-04-03T10:00:00.000Z';
    store.persist();
    await page.reload();
    await page.locator('[data-harness-ready="true"]').waitFor();
    assert.equal(await page.getByTestId('bookmark-card').count(), 12);
    await page.getByRole('button', { name: /Health/ }).click();
    assert.equal(await page.getByTestId('bookmark-card').count(), 1, 'filter must find a bookmark outside the initial visible batch');
    await page.getByRole('button', { name: /All bookmarks/ }).click();
    await page.getByRole('button', { name: /Show more bookmarks/ }).click();
    assert.equal(await page.getByTestId('bookmark-card').count(), 15);

    await page.getByRole('button', { name: /Health/ }).click();
    assert.equal(await page.getByTestId('bookmark-card').count(), 1);
    const longCard = page.getByTestId('bookmark-card');
    assert.match(await longCard.locator('.more-tags').innerText(), /\+2 more/);
    await longCard.getByRole('button', { name: 'Show full details' }).click();
    assert.equal(await page.getByTestId('bookmark-card').getAttribute('class').then((value) => value.includes('expanded')), true);
    await longCard.getByRole('button', { name: 'Show less' }).click();
    assert.equal(await page.getByTestId('bookmark-card').getAttribute('class').then((value) => value.includes('expanded')), false);

    await page.getByRole('button', { name: /Read later/ }).first().click();
    await page.getByTestId('empty-later').waitFor();
    await page.getByRole('button', { name: 'Show all bookmarks' }).click();
    assert.equal(await page.getByTestId('bookmark-card').count(), 12);

    await page.locator('#search').fill('private reference');
    assert.match(await page.getByTestId('bookmark-card').locator('.saved-date').innerText(), /Saved Apr 3, 2025/);
    await page.locator('#search').fill('');

    const secondContext = await browser.newContext();
    const returningPage = await secondContext.newPage();
    await returningPage.goto(base);
    await returningPage.locator('[data-harness-ready="true"]').waitFor();
    assert.equal(await returningPage.locator('#all-count').innerText(), '15');
    await secondContext.close();

    let interrupted = false;
    await page.route('**/api/bookmarks/*', async (route) => {
      if (route.request().method() === 'PUT' && !interrupted) {
        interrupted = true;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary interruption', code: 'SERVER_ERROR' }) });
      } else {
        await route.continue();
      }
    });
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const retryEdit = page.getByTestId('edit-card');
    await retryEdit.getByLabel('Title').fill('This edit survives retry');
    await retryEdit.getByRole('button', { name: 'Save changes' }).click();
    await retryEdit.locator('.inline-message:not([hidden])').waitFor();
    assert.equal(await retryEdit.getByLabel('Title').inputValue(), 'This edit survives retry');
    await retryEdit.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('This edit survives retry', { exact: true }).waitFor();

    console.log('PASS: production browser journey covers create, open, tag, search, Read later, edit, duplicate prevention, remove, recovery, compact cards, and large libraries');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
