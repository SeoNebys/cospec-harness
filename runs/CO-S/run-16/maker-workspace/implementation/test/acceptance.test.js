import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { createAppServer } from '../server.js';
import { createBookmark } from '../src/domain.js';

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

test('approved bookmark flows work together in the production application', { timeout: 60_000 }, async () => {
  let pageVersion = 1;
  const fixture = http.createServer((request, response) => {
    if (request.url === '/broken') {
      response.writeHead(503, { 'content-type': 'text/html' });
      return response.end('unavailable');
    }
    const title = pageVersion === 1 ? 'CSS layout field guide' : 'CSS layout cookbook';
    const description = pageVersion === 1 ? 'A detailed guide to practical page layout.' : 'Updated layout recipes for common interface patterns.';
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(`<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}"><meta property="og:image" content="/cover.jpg"></head><body>${'<p>layout word </p>'.repeat(500)}</body></html>`);
  });
  const fixturePort = await listen(fixture);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'lattice-test-'));
  const { server, store } = await createAppServer({ dataFile: join(temporaryDirectory, 'bookmarks.json'), allowPrivateFetch: true });
  const appPort = await listen(server);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`http://127.0.0.1:${appPort}`, { waitUntil: 'networkidle' });
    await page.locator('[data-harness-ready="true"]').waitFor();
    await assert.doesNotReject(() => page.getByRole('heading', { name: 'Build a collection worth returning to' }).waitFor());

    await page.getByRole('button', { name: 'Save a link' }).click();
    await page.locator('#bookmark-url').fill('not a web address');
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    await page.getByText('Enter a complete web address').waitFor();
    assert.equal((await page.locator('.bookmark-card').count()), 0);

    const articleUrl = `http://127.0.0.1:${fixturePort}/article`;
    await page.locator('#bookmark-url').fill(articleUrl);
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    await page.getByText('Bookmark saved').waitFor();
    let card = page.locator('.bookmark-card').filter({ hasText: 'CSS layout field guide' });
    await card.waitFor();
    assert.match(await card.innerText(), /detailed guide/i);
    assert.match(await card.innerText(), /min read/i);

    await page.getByRole('button', { name: 'Save a link' }).click();
    await page.locator('#bookmark-url').fill(articleUrl);
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    await page.getByText('This link is already saved').waitFor();
    assert.equal((await page.locator('.bookmark-card').count()), 1);
    await page.getByRole('button', { name: 'View existing' }).click();
    await page.locator('.bookmark-card.located').waitFor();

    card = page.locator('.bookmark-card').filter({ hasText: 'CSS layout field guide' });
    await card.getByRole('button', { name: 'Add tag' }).click();
    await card.getByPlaceholder('e.g. Reference').fill('Design');
    await card.getByRole('button', { name: 'Add tag', exact: true }).click();
    await page.getByText('The bookmark and sidebar are updated').waitFor();
    await card.getByRole('button', { name: /Options/ }).click();
    await card.getByRole('button', { name: 'Add note' }).click();
    await page.locator('#editor-value').fill('Review this before rebuilding my portfolio.');
    await page.getByRole('button', { name: 'Save note' }).click();
    await page.getByText('Note saved').waitFor();

    await page.locator('#search-input').fill('rebuilding');
    await page.getByText('1 result').waitFor();
    assert.equal((await page.locator('.bookmark-card').count()), 1);
    assert.equal((await page.locator('.note-block mark').innerText()), 'rebuilding');
    await page.getByRole('button', { name: 'Clear filters' }).click();

    card = page.locator('.bookmark-card').filter({ hasText: 'CSS layout field guide' });
    await card.getByRole('button', { name: 'Add to Read later' }).click();
    await page.getByText('Added to Read later').waitFor();
    await page.getByRole('button', { name: /Read later 1/ }).click();
    card = page.locator('.bookmark-card').filter({ hasText: 'CSS layout field guide' });
    await card.getByRole('button', { name: 'Remove from Read later' }).click();
    await page.getByRole('heading', { name: 'Nothing waiting to be read' }).waitFor();
    await page.getByRole('button', { name: /All bookmarks 1/ }).click();

    card = page.locator('.bookmark-card').filter({ hasText: 'CSS layout field guide' });
    await card.getByRole('button', { name: /Options/ }).click();
    await card.getByRole('button', { name: 'Archive bookmark' }).click();
    await page.getByText('Bookmark archived').waitFor();
    await page.getByRole('button', { name: /Archive 1/ }).click();
    card = page.locator('.bookmark-card').filter({ hasText: 'CSS layout field guide' });
    await card.getByRole('button', { name: /Options/ }).click();
    await card.getByRole('button', { name: 'Restore to collection' }).click();
    await page.getByRole('heading', { name: 'Archive is empty' }).waitFor();

    await page.getByRole('button', { name: /All bookmarks 1/ }).click();
    card = page.locator('.bookmark-card').filter({ hasText: 'CSS layout field guide' });
    pageVersion = 2;
    await card.getByRole('button', { name: /Options/ }).click();
    await card.getByRole('button', { name: 'Refresh page details' }).click();
    await page.getByText('Page details refreshed').waitFor();
    card = page.locator('.bookmark-card').filter({ hasText: 'CSS layout cookbook' });
    assert.match(await card.innerText(), /rebuilding my portfolio/i);
    assert.match(await card.innerText(), /Design/);

    await page.getByRole('button', { name: 'Save a link' }).click();
    await page.locator('#bookmark-url').fill(`http://127.0.0.1:${fixturePort}/broken`);
    await page.getByRole('button', { name: 'Save bookmark' }).click();
    await page.getByText('Link saved as a basic card').waitFor();
    const basicCard = page.locator('.bookmark-card').filter({ hasText: 'Untitled bookmark' });
    await basicCard.getByRole('button', { name: /Options/ }).click();
    await basicCard.getByRole('button', { name: 'Edit title' }).click();
    await page.locator('#editor-title-value').fill('Offline reference');
    await page.getByRole('button', { name: 'Save title' }).click();
    await page.getByRole('heading', { name: 'Offline reference' }).waitFor();

    for (let index = 0; index < 20; index += 1) {
      const bookmark = createBookmark(`https://example.com/item-${index}`, {
        title: `Saved example ${index}`, description: 'A stored example for pagination.', image: '', readingMinutes: 2
      });
      store.bookmarks.push(bookmark);
    }
    await store.save();
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-harness-ready="true"]').waitFor();
    await page.getByRole('button', { name: 'Page 2' }).click();
    await page.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current').then(value => assert.equal(value, 'page'));
  } finally {
    await browser.close();
    await close(server);
    await close(fixture);
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('filtering, compact cards, note revision, and refresh safeguards match the approved edge cases', { timeout: 60_000 }, async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'lattice-details-'));
  let refreshMode = 'success';
  const metadataFetcher = async url => {
    if (refreshMode === 'failure' || url.includes('source-match')) throw new Error('Page unavailable.');
    return {
      title: url.includes('offline') ? 'Recovered reference' : 'Updated systems atlas',
      description: 'Newly captured details after a deliberate refresh.',
      image: 'https://images.example/new-cover.jpg',
      readingMinutes: 9
    };
  };
  const { server, store } = await createAppServer({
    dataFile: join(temporaryDirectory, 'bookmarks.json'), metadataFetcher
  });

  const longTitle = `Copenhagen systems field notes ${'for patient interface research '.repeat(5)}`.trim();
  const target = createBookmark('https://design.example/copenhagen', {
    title: longTitle,
    description: `An older captured description about humane navigation. ${'Long-form context '.repeat(20)}`,
    image: 'https://images.example/old-cover.jpg',
    readingMinutes: 4
  });
  target.tags = ['Design', 'Research', 'Reference', 'Reading', 'Ideas', 'Copenhagen'];
  target.note = `Keep the fjordmarker idea in mind. ${'Personal context '.repeat(14)}`;

  const sourceMatch = createBookmark('https://source-match.example/article', {
    title: 'A plain saved page', description: 'Nothing unusual here.', image: '', readingMinutes: 2
  });
  const descriptionMatch = createBookmark('https://writing.example/article', {
    title: 'Writing notes', description: 'A nebula appears only in this captured description.', image: '', readingMinutes: 3
  });
  const offline = createBookmark('https://offline.example/unavailable');
  offline.title = 'My offline reference';
  offline.manualTitle = true;
  const fillers = Array.from({ length: 20 }, (_, index) => createBookmark(`https://fillers.example/${index}`, {
    title: `Filler bookmark ${index}`, description: 'Pagination fixture.', image: '', readingMinutes: 1
  }));
  const crossPage = fillers.at(-1);
  crossPage.title = 'A far-away match';
  crossPage.description = 'The crosspageonly phrase belongs to this later page.';
  crossPage.tags = ['Design'];
  store.bookmarks = [target, sourceMatch, descriptionMatch, offline, ...fillers];
  await store.save();

  const appPort = await listen(server);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`http://127.0.0.1:${appPort}`, { waitUntil: 'networkidle' });
    await page.locator('[data-harness-ready="true"]').waitFor();

    // SCN-002: every captured field is searched case-insensitively and highlighted.
    for (const [query, cardText] of [
      ['copenhagen', 'Copenhagen systems field notes'],
      ['SOURCE-MATCH', 'A plain saved page'],
      ['NEBULA', 'Writing notes']
    ]) {
      await page.locator('#search-input').fill(query);
      await page.getByText('1 result').waitFor();
      assert.equal(await page.locator('.bookmark-card').count(), 1);
      assert.match(await page.locator('.bookmark-card').innerText(), new RegExp(cardText, 'i'));
      assert.equal(await page.locator('.bookmark-card mark').count(), 1);
      await page.getByRole('button', { name: 'Clear filters' }).click();
    }

    // SCN-003 and SCN-019: visible tag counts, active state, and whole-collection intersection.
    const designFilter = page.locator('#tag-nav [data-tag="Design"]');
    assert.match(await designFilter.innerText(), /2/);
    await designFilter.click();
    await page.getByText('2 results').waitFor();
    assert.equal(await page.locator('.bookmark-card').count(), 2);
    assert.equal(await designFilter.evaluate(node => node.classList.contains('active')), true);
    assert.equal(await page.locator('.bookmark-card [data-card-tag="Design"]').count(), 2);
    await page.locator('#search-input').fill('crosspageonly');
    await page.getByText('1 result').waitFor();
    assert.match(await page.locator('#filter-description').innerText(), /crosspageonly.*Design/i);
    assert.match(await page.locator('.bookmark-card').innerText(), /far-away match/i);
    await page.getByRole('button', { name: 'Clear filters' }).click();

    // SCN-011: an empty result keeps the phrase and clearing it restores the page.
    await page.locator('#search-input').fill('nothing-could-possibly-match-this');
    await page.getByRole('heading', { name: 'No bookmarks found' }).waitFor();
    assert.equal(await page.locator('#search-input').inputValue(), 'nothing-could-possibly-match-this');
    await page.locator('#empty-results').getByRole('button', { name: 'Clear filters' }).click();
    assert.equal(await page.locator('.bookmark-card').count(), 20);

    // SCN-017: long content stays clamped, then reveals every tag in place and collapses again.
    let targetCard = page.locator(`.bookmark-card[data-id="${target.id}"]`);
    assert.equal(await targetCard.evaluate(node => node.classList.contains('expanded')), false);
    assert.equal(await targetCard.locator('.card-tag').nth(4).evaluate(node => getComputedStyle(node).display), 'none');
    await targetCard.getByRole('button', { name: 'Show more' }).click();
    targetCard = page.locator(`.bookmark-card[data-id="${target.id}"]`);
    assert.equal(await targetCard.evaluate(node => node.classList.contains('expanded')), true);
    assert.notEqual(await targetCard.locator('.card-tag').nth(4).evaluate(node => getComputedStyle(node).display), 'none');
    await targetCard.getByRole('button', { name: 'Show less' }).click();
    assert.equal(await targetCard.evaluate(node => node.classList.contains('expanded')), false);

    // SCN-012: capitalization reuses the established tag and increments only that count.
    let sourceCard = page.locator(`.bookmark-card[data-id="${sourceMatch.id}"]`);
    await sourceCard.getByRole('button', { name: 'Add tag' }).click();
    await sourceCard.getByPlaceholder('e.g. Reference').fill('design');
    await sourceCard.getByRole('button', { name: 'Add tag', exact: true }).click();
    await page.getByText('Your existing tag was reused').waitFor();
    assert.match(await page.locator('#tag-nav [data-tag="Design"]').innerText(), /3/);
    assert.equal(await page.locator('#tag-nav [data-tag="design"]').count(), 0);

    // SCN-015: the note editor is prefilled and replacing it leaves no old reminder.
    targetCard = page.locator(`.bookmark-card[data-id="${target.id}"]`);
    await targetCard.getByRole('button', { name: /Options/ }).click();
    await targetCard.getByRole('button', { name: 'Edit note' }).click();
    assert.match(await page.locator('#editor-value').inputValue(), /fjordmarker/);
    await page.locator('#editor-value').fill('Use this revised reminder only.');
    await page.getByRole('button', { name: 'Save note' }).click();
    await page.getByText('Note saved').waitFor();
    targetCard = page.locator(`.bookmark-card[data-id="${target.id}"]`);
    assert.match(await targetCard.innerText(), /revised reminder only/i);
    assert.doesNotMatch(await targetCard.innerText(), /fjordmarker/i);

    // SCN-020: details remain stable until refresh; success preserves personal data.
    assert.match(await targetCard.innerText(), /older captured description/i);
    assert.match(await targetCard.innerText(), /4 min read/i);
    await targetCard.getByRole('button', { name: /Options/ }).click();
    await targetCard.getByRole('button', { name: 'Refresh page details' }).click();
    await page.getByText('Page details refreshed').waitFor();
    targetCard = page.locator(`.bookmark-card[data-id="${target.id}"]`);
    assert.match(await targetCard.innerText(), /Updated systems atlas/);
    assert.match(await targetCard.innerText(), /Newly captured details/);
    assert.match(await targetCard.innerText(), /9 min read/);
    assert.match(await targetCard.innerText(), /revised reminder only/i);
    assert.match(await targetCard.innerText(), /Design/);
    assert.equal(await targetCard.locator('.preview img').getAttribute('src'), 'https://images.example/new-cover.jpg');

    // A failed refresh preserves every saved field.
    sourceCard = page.locator(`.bookmark-card[data-id="${sourceMatch.id}"]`);
    const sourceBefore = await sourceCard.innerText();
    await sourceCard.getByRole('button', { name: /Options/ }).click();
    await sourceCard.getByRole('button', { name: 'Refresh page details' }).click();
    await page.getByText('Refresh couldn’t finish').waitFor();
    sourceCard = page.locator(`.bookmark-card[data-id="${sourceMatch.id}"]`);
    assert.equal(await sourceCard.innerText(), sourceBefore);

    // A personal title on a basic card is not overwritten without confirmation.
    let offlineCard = page.locator(`.bookmark-card[data-id="${offline.id}"]`);
    page.once('dialog', dialog => dialog.dismiss());
    await offlineCard.getByRole('button', { name: /Options/ }).click();
    await offlineCard.getByRole('button', { name: 'Refresh page details' }).click();
    offlineCard = page.locator(`.bookmark-card[data-id="${offline.id}"]`);
    assert.match(await offlineCard.innerText(), /My offline reference/);
    await offlineCard.getByRole('button', { name: /Options/ }).click();
    assert.equal(await offlineCard.getByRole('button', { name: 'Edit title' }).count(), 1);

    // SCN-018: ordinary browsing presents 20 per page with direct and adjacent controls.
    assert.equal(await page.locator('.bookmark-card').count(), 20);
    assert.equal(await page.getByRole('button', { name: 'Previous page' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current'), 'page');
    await page.getByRole('button', { name: 'Page 2' }).click();
    assert.equal(await page.locator('.bookmark-card').count(), 4);
    assert.equal(await page.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current'), 'page');
    assert.equal(await page.getByRole('button', { name: 'Next page' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Previous page' }).click();
    assert.equal(await page.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current'), 'page');
  } finally {
    await browser.close();
    await close(server);
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
