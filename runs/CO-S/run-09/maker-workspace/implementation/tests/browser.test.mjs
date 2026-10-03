import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startTestApp } from './helpers.mjs';

test('approved browser flows work together as a dependable personal library', async t => {
  const env = await startTestApp();
  t.after(env.close);
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  await page.goto(env.app.baseUrl);
  await page.locator('[data-harness-ready="true"]').waitFor();

  assert.equal(await page.locator('.bookmark-card').count(), 0, 'SCN-001 starts with an empty library');
  await page.locator('#url-input').fill('not a link');
  await page.locator('.save-result.error').waitFor();
  assert.match(await page.locator('#save-result').innerText(), /complete web address/i, 'SCN-010 malformed text explains how to recover');
  assert.equal(await page.locator('[data-save-preview]').count(), 0, 'SCN-010 malformed text cannot be saved');

  const article = `${env.fixture.baseUrl}/article`;
  await page.locator('#url-input').fill(article);
  await page.locator('[data-save-preview]').waitFor();
  assert.equal(await page.locator('.result-title').innerText(), 'Designing for Readers', 'SCN-001 metadata is previewed');
  assert.match(await page.locator('#save-result').innerText(), /Practical ways to make reading/, 'SCN-001 description is previewed');
  assert.match(await page.locator('#save-result .source-line').innerText(), /127\.0\.0\.1/, 'SCN-001 source is previewed');
  await page.locator('#save-result .preview-image img').waitFor();
  await page.locator('#save-result .source-icon img').waitFor();
  assert.equal(await page.locator('#save-result img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true, 'SCN-001 icon and preview are visible');
  await page.locator('[data-save-preview]').click();
  await page.locator('.bookmark-card').waitFor();
  assert.match(await page.locator('.notice').innerText(), /Saved to your library/, 'SCN-001 save is confirmed');
  const savedCardText = await page.locator('.bookmark-card').innerText();
  assert.match(savedCardText, /Designing for Readers/);
  assert.match(savedCardText, /Practical ways to make reading/);
  assert.match(savedCardText, /127\.0\.0\.1/);
  await page.locator('.bookmark-card .card-image img').waitFor();
  await page.locator('.bookmark-card .source-icon img').waitFor();
  assert.equal(await page.locator('#result-count').innerText(), '1 bookmark');
  assert.match(await page.locator('.bookmark-card').innerText(), /Readable copy ready/i, 'SCN-009 copy is captured on save');

  await page.locator('#url-input').fill(`${article}/?utm_source=newsletter`);
  await page.locator('[data-review-duplicate]').waitFor();
  assert.match(await page.locator('#save-result').innerText(), /already in your library/, 'SCN-012 referral duplicate is detected');
  assert.match(await page.locator('#save-result').innerText(), /Designing for Readers/, 'SCN-002 matching bookmark is identified');
  assert.match(await page.locator('#save-result').innerText(), /no copy will be made/i, 'SCN-002 duplicate handling is explicit');
  assert.equal(await page.locator('[data-review-duplicate]').innerText(), 'Review & update');
  assert.equal(await page.locator('.bookmark-card').count(), 1, 'SCN-002 duplicate is not created');
  await page.locator('[data-review-duplicate]').click();
  await page.locator('#edit-backdrop:not([hidden])').waitFor();
  assert.equal(await page.locator('#edit-title').inputValue(), 'Designing for Readers', 'SCN-002 original opens prefilled');
  assert.match(await page.locator('#edit-description').inputValue(), /Practical ways to make reading/);
  assert.match(await page.locator('#edit-context').innerText(), /no copy will be made/i);
  await page.locator('#edit-title').fill('Designing for Focused Reading');
  await page.locator('#edit-note').fill('Use this for the typography workshop');
  await page.locator('#new-tag').fill('design');
  await page.locator('#add-tag').click();
  await page.locator('#new-tag').fill('Design');
  await page.locator('#add-tag').click();
  assert.equal(await page.locator('#selected-tags .selected-tag').count(), 1, 'SCN-014 duplicate tag is not created');
  assert.match(await page.locator('#tag-message').innerText(), /already selected/);
  await page.locator('#edit-form button[type="submit"]').click();
  await page.locator('#edit-backdrop').waitFor({ state: 'hidden' });
  assert.match(await page.locator('.notice').innerText(), /Bookmark details updated/, 'SCN-002 update is confirmed');
  assert.match(await page.locator('.bookmark-card').innerText(), /Designing for Focused Reading/, 'SCN-002 original card is updated');
  assert.match(await page.locator('.bookmark-card').innerText(), /typography workshop/, 'SCN-004 note appears on card');
  assert.equal(await page.locator('.bookmark-card').count(), 1, 'SCN-002 count stays unchanged after update');

  const extraBookmarks = [
    {
      url: `${env.fixture.baseUrl}/humane`, title: 'Attention Is a Design Material',
      description: 'Building humane interfaces for busy digital spaces.', source: 'Design Notes',
      note: 'Share with the product team.', tags: ['design', 'interfaces']
    },
    {
      url: `${env.fixture.baseUrl}/deep-work`, title: 'A Field Guide to Deep Work',
      description: 'Practical routines for sustained concentration.', source: 'Focus Journal',
      note: 'Try this next month.', tags: ['focus']
    }
  ];
  for (const bookmark of extraBookmarks) {
    const response = await page.request.post(`${env.app.baseUrl}/api/bookmarks`, {
      data: { ...bookmark, archive: { status: 'ready', body: ['A complete readable section retained for later reference.'] } }
    });
    assert.equal(response.status(), 201);
  }
  await page.reload();
  await page.locator('[data-harness-ready="true"]').waitFor();
  await page.locator('.bookmark-card').first().waitFor();

  await page.locator('#search-input').fill('workshop');
  assert.equal(await page.locator('.bookmark-card').count(), 1, 'SCN-003 note search finds bookmark');
  assert.match(await page.locator('.bookmark-card .card-note').innerText(), /typography workshop/, 'SCN-003 matching note stays visible');
  await page.locator('#search-input').fill('humane');
  assert.equal(await page.locator('.bookmark-card').count(), 1, 'SCN-003 description search finds bookmark');
  assert.match(await page.locator('.bookmark-card .card-description').innerText(), /humane/, 'SCN-003 matching description stays visible');
  await page.locator('#search-input').fill('deep work');
  assert.equal(await page.locator('.bookmark-card').count(), 1, 'SCN-003 title search finds bookmark');
  assert.equal(await page.locator('.bookmark-card .card-title').innerText(), 'A Field Guide to Deep Work', 'SCN-003 matching title stays visible');
  await page.locator('#search-input').fill('volcano');
  await page.locator('#empty-state.show').waitFor();
  assert.equal(await page.locator('#result-count').innerText(), '0 bookmarks', 'SCN-011 no-result count is honest');
  assert.match(await page.locator('#empty-title').innerText(), /No bookmarks match/);
  assert.equal(await page.locator('#search-input').inputValue(), 'volcano', 'SCN-011 query is retained');
  await page.locator('#clear-filter').click();

  const tagFilter = page.locator('[data-filter-tag="design"]');
  assert.equal(await tagFilter.count(), 1, 'SCN-007 existing tags are visible in the sidebar');
  await tagFilter.click();
  assert.equal(await page.locator('.bookmark-card').count(), 2, 'SCN-007 sidebar tag filter narrows library');
  assert.match(await page.locator('#collection-title').innerText(), /Tagged design/);
  assert.equal(await page.locator('#result-count').innerText(), '2 bookmarks', 'SCN-007 count reflects the narrowed library');
  assert.equal(await page.locator('.bookmark-card .tag-pill').filter({ hasText: /^design$/ }).count(), 2, 'SCN-007 result tags remain visible');
  await page.locator('#clear-filter').click();

  const focusedCard = page.locator('.bookmark-card', { hasText: 'Designing for Focused Reading' });
  await focusedCard.locator('[data-edit]').click();
  assert.match(await page.locator('#edit-title').inputValue(), /Designing for Focused Reading/, 'SCN-004 one prefilled edit form opens');
  assert.match(await page.locator('#edit-note').inputValue(), /typography workshop/);
  await page.locator('[data-remove-tag="design"]').click();
  assert.equal(await page.locator('#selected-tags [data-remove-tag="design"]').count(), 0, 'SCN-004 a selected tag can be removed');
  await page.locator('[data-suggest-tag="design"]').click();
  assert.equal(await page.locator('#selected-tags [data-remove-tag="design"]').count(), 1, 'SCN-004 an existing tag can be reused in one click');
  await page.locator('#new-tag').fill('typography');
  await page.locator('#add-tag').click();
  assert.equal(await page.locator('#selected-tags [data-remove-tag="typography"]').count(), 1, 'SCN-004 Add creates a removable tag');
  await page.locator('[data-remove-tag="typography"]').click();
  await page.locator('#edit-form button[type="submit"]').click();
  await page.locator('#edit-backdrop').waitFor({ state: 'hidden' });
  assert.match(await page.locator('.notice').innerText(), /Bookmark details updated/, 'SCN-004 managed details update is confirmed');

  for (const bookmark of env.app.store.list().filter(item => item.url !== article)) await env.app.store.remove(bookmark.id);
  await page.reload();
  await page.locator('[data-harness-ready="true"]').waitFor();
  await page.locator('[data-edit]').click();
  const longTitle = 'A remarkably long guide to designing calm, readable, resilient digital experiences for people navigating information-rich websites every day, including the subtle editorial choices that help readers stay oriented through dense and demanding material';
  const longDescription = 'An extensive exploration of typography, structure, accessibility, attention, reading patterns, and many small design decisions that keep complex articles understandable, approachable, and useful across devices for readers returning after a long absence. It also considers navigation, hierarchy, contrast, responsive spacing, and the quiet cues that help someone resume exactly where they left off.';
  const longNote = 'Return to the sections about line length and visual rhythm before the next workshop, compare all recommendations with the current layout, record the changes worth testing with the team, and add examples from the latest research session before sharing the final notes. Revisit the annotated case study as well, because its before-and-after comparison may be the clearest example for the group.';
  await page.locator('#edit-title').fill(longTitle);
  await page.locator('#edit-description').fill(longDescription);
  await page.locator('#edit-note').fill(longNote);
  for (const tag of ['typography', 'accessibility', 'interaction-design', 'editorial-design', 'reading-research', 'information-architecture', 'responsive-layout', 'content-strategy', 'reader-attention', 'visual-hierarchy', 'inclusive-design', 'design-systems']) {
    await page.locator('#new-tag').fill(tag);
    await page.locator('#add-tag').click();
  }
  await page.locator('#edit-form button[type="submit"]').click();
  await page.locator('#edit-backdrop').waitFor({ state: 'hidden' });
  for (const selector of ['.card-title', '.card-description', '.card-note']) {
    const dimensions = await page.locator(selector).evaluate(element => ({ shown: element.clientHeight, full: element.scrollHeight }));
    assert.ok(dimensions.full > dimensions.shown, `SCN-013 ${selector} is visibly shortened on the card`);
  }
  const tagRows = await page.locator('.card-tags .tag-pill').evaluateAll(tags => new Set(tags.map(tag => tag.offsetTop)).size);
  assert.ok(tagRows > 1, 'SCN-013 long tag set wraps onto multiple rows');
  await page.locator('[data-edit]').click();
  assert.equal(await page.locator('#edit-title').inputValue(), longTitle, 'SCN-013 full title is preserved in edit');
  assert.equal(await page.locator('#edit-description').inputValue(), longDescription, 'SCN-013 full description is preserved in edit');
  assert.equal(await page.locator('#edit-note').inputValue(), longNote, 'SCN-013 full note is preserved in edit');
  await page.locator('#close-edit').click();

  await page.locator('[data-later]').click();
  await page.waitForFunction(() => document.querySelector('.notice')?.textContent.includes('Added to Read later'));
  assert.match(await page.locator('.notice').innerText(), /Added to Read later/, 'SCN-006 mark is confirmed');
  assert.match(await page.locator('[data-later]').innerText(), /Saved for later/, 'SCN-006 visible status changes');
  assert.equal(await page.locator('#later-count').innerText(), '1');
  await page.locator('#nav-later').click();
  assert.equal(await page.locator('#collection-title').innerText(), 'Read later', 'SCN-006 sidebar opens a dedicated shortlist');
  assert.equal(await page.locator('.bookmark-card').count(), 1, 'SCN-006 marked item appears in shortlist');
  await page.locator('[data-later]').click();
  await page.locator('#empty-state.show').waitFor();
  assert.match(await page.locator('.notice').innerText(), /Removed from Read later/, 'SCN-006 removal is confirmed');
  assert.match(await page.locator('#empty-title').innerText(), /Nothing waiting/, 'SCN-006 shortlist clears');
  assert.equal(await page.locator('#later-count').innerText(), '0');
  assert.equal(await page.locator('#all-count').innerText(), '1', 'SCN-006 bookmark remains in main library');
  await page.locator('#nav-all').click();

  const originalPopupPromise = context.waitForEvent('page');
  await page.locator('.card-title').click();
  const originalPopup = await originalPopupPromise;
  await originalPopup.waitForURL(`${article}`);
  assert.equal(page.url(), `${env.app.baseUrl}/`, 'SCN-005 library tab stays in place');
  await originalPopup.close();

  env.fixture.status.article = false;
  await page.reload();
  await page.locator('[data-harness-ready="true"]').waitFor();
  await page.waitForFunction(() => document.querySelector('.bookmark-card')?.textContent.includes('Original unavailable'));
  assert.match(await page.locator('.bookmark-card').innerText(), /Original unavailable · saved copy ready/i, 'SCN-009 card warns before it is clicked');
  const archivePopupPromise = context.waitForEvent('page');
  await page.locator('.card-title').click();
  const archivePopup = await archivePopupPromise;
  await archivePopup.waitForURL(/archive\.html\?id=/);
  await archivePopup.locator('[data-harness-ready="true"]').waitFor();
  assert.match(await archivePopup.locator('h1').innerText(), /remarkably long guide/, 'SCN-009 saved copy keeps current bookmark title');
  assert.equal(await archivePopup.locator('.description').innerText(), longDescription, 'SCN-009 saved copy contains the description');
  assert.ok(await archivePopup.locator('.article-body p').count() >= 2, 'SCN-009 saved copy contains body text');
  assert.equal(page.url(), `${env.app.baseUrl}/`, 'SCN-009 library remains in original tab');
  await archivePopup.close();

  await page.locator('[data-edit]').click();
  await page.locator('#request-delete').click();
  await page.locator('#delete-backdrop:not([hidden])').waitFor();
  assert.match(await page.locator('#delete-heading').innerText(), /remarkably long guide/, 'SCN-008 delete confirmation names bookmark');
  assert.match(await page.locator('#delete-copy').innerText(), /personal note.*tags/i, 'SCN-008 confirmation explains attached context will be removed');
  assert.equal(await page.locator('#cancel-delete').innerText(), 'Keep bookmark');
  assert.equal(await page.locator('#confirm-delete').innerText(), 'Delete bookmark');
  await page.locator('#cancel-delete').click();
  assert.equal(await page.locator('#delete-backdrop').isHidden(), true, 'SCN-015 delete warning closes');
  assert.equal(await page.locator('#edit-backdrop').isVisible(), true, 'SCN-015 unchanged edit form returns');
  assert.equal(await page.locator('#edit-title').inputValue(), longTitle, 'SCN-015 cancel keeps unchanged edit form');
  await page.locator('#request-delete').click();
  await page.locator('#confirm-delete').click();
  await page.locator('#empty-state.show').waitFor();
  await page.waitForFunction(() => document.querySelector('.notice')?.textContent.includes('Bookmark deleted'));
  assert.match(await page.locator('.notice').innerText(), /Bookmark deleted/, 'SCN-008 deletion is unmistakable');
  assert.match(await page.locator('#empty-title').innerText(), /library is ready/i, 'SCN-008 empty library is clear');

  const flaky = `${env.fixture.baseUrl}/flaky`;
  await page.locator('#url-input').fill(flaky);
  await page.locator('[data-manual-url]').waitFor();
  assert.match(await page.locator('#save-result').innerText(), /couldn’t reach this page/, 'SCN-010 unreachable page is explained');
  assert.equal(await page.locator('#url-input').inputValue(), flaky, 'SCN-010 valid address is retained');
  assert.equal(await page.locator('[data-retry-preview]').innerText(), 'Try again');
  assert.equal(await page.locator('[data-manual-url]').innerText(), 'Add details manually');
  await page.locator('[data-manual-url]').click();
  assert.equal(await page.locator('#manual-form [name="url"]').inputValue(), flaky, 'SCN-010 manual form keeps the address attached');
  assert.match(await page.locator('#manual-form').innerText(), /readable copy is not available yet/i);
  await page.locator('#manual-form [name="title"]').fill('Offline research article');
  await page.locator('#manual-form [name="description"]').fill('My manually entered description');
  await page.locator('#manual-form [name="note"]').fill('My manually entered note');
  await page.locator('#manual-form button[type="submit"]').click();
  await page.locator('.bookmark-card').waitFor();
  assert.match(await page.locator('.notice').innerText(), /Bookmark saved.*readable copy pending/i, 'SCN-010 manual save is confirmed honestly');
  assert.match(await page.locator('.bookmark-card').innerText(), /Readable copy pending/i, 'SCN-010 manual save is honest about pending copy');
  assert.match(await page.locator('.bookmark-card').innerText(), /Offline research article/);
  assert.match(await page.locator('.bookmark-card').innerText(), /My manually entered description/);
  assert.match(await page.locator('.bookmark-card').innerText(), /My manually entered note/);
  env.fixture.status.flaky = true;
  const [manualBookmark] = env.app.store.list();
  await page.request.post(`${env.app.baseUrl}/api/bookmarks/${manualBookmark.id}/retry`);
  await page.reload();
  await page.locator('[data-harness-ready="true"]').waitFor();
  const recoveredText = await page.locator('.bookmark-card').innerText();
  assert.match(recoveredText, /Readable copy ready/i, 'SCN-010 later capture becomes ready');
  assert.match(recoveredText, /Offline research article/, 'SCN-010 manual title is not overwritten');
  assert.match(recoveredText, /My manually entered note/, 'SCN-010 manual note is not overwritten');
});
