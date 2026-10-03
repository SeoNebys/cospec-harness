import { test, expect } from '@playwright/test';

// End-to-end acceptance tests mapped to approved scenarios. They run against a
// dedicated server with isolated data. Network fetches of external pages fail in
// this environment, so tests exercise the recovery path (SCN-011) and supply
// titles manually; this does not affect the behaviours under test.

async function addBookmark(page, url, { title, tags, note, readLater = true } = {}) {
  await page.fill('#url', url);
  // wait for either the fields (fetch attempted) or the duplicate banner
  await page.waitForFunction(() => {
    const f = document.getElementById('fields');
    const d = document.getElementById('dupbanner');
    return (f && !f.hidden) || (d && !d.hidden);
  }, { timeout: 8000 });
  if (title !== undefined) await page.fill('#title', title);
  if (tags) await page.fill('#tags', tags);
  if (note) await page.fill('#note', note);
  if (!readLater) await page.uncheck('#readlater');
  await page.click('.composer .save');
  // wait for the save to settle (composer resets: fields hidden again)
  await page.waitForFunction(() => document.getElementById('fields').hidden, { timeout: 8000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-harness-ready="true"]');
});

test('SCN-012: non-address is rejected with a message', async ({ page }) => {
  await page.fill('#url', 'just some text');
  await expect(page.locator('#fetchnote')).toContainText('valid address', { timeout: 8000 });
  await expect(page.locator('#fields')).toBeHidden();
});

test('SCN-001/011: save a link (fetch fails -> manual title) appears in list', async ({ page }) => {
  await addBookmark(page, 'https://scn1.example.test/page', { title: 'SCN1 Title', tags: 'alpha' });
  await expect(page.locator('.item', { hasText: 'SCN1 Title' })).toBeVisible();
});

test('SCN-003: duplicate link shows the already-saved banner', async ({ page }) => {
  await addBookmark(page, 'https://dup.example.test/x', { title: 'Dup One' });
  await expect(page.locator('.item', { hasText: 'Dup One' })).toBeVisible();
  await page.fill('#url', 'http://www.dup.example.test/x/');
  await expect(page.locator('#dupbanner')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#dupbanner')).toContainText('already saved');
});

test('SCN-025: bookmark title links to the original address', async ({ page }) => {
  await addBookmark(page, 'https://link.example.test/orig', { title: 'Link Target' });
  const a = page.locator('.item', { hasText: 'Link Target' }).locator('.title a');
  await expect(a).toHaveAttribute('href', 'https://link.example.test/orig');
});

test('SCN-006/007: search everything, #tag exact, boolean', async ({ page }) => {
  await addBookmark(page, 'https://s1.example.test', { title: 'Rome guide', tags: 'travel' });
  await addBookmark(page, 'https://s2.example.test', { title: 'Rome book', tags: 'book' });
  await addBookmark(page, 'https://s3.example.test', { title: 'Paris news', tags: 'news' });
  await page.fill('#search', 'rome');
  await expect(page.locator('.item')).toHaveCount(2);
  await page.fill('#search', 'rome NOT #travel');
  await expect(page.locator('.item')).toHaveCount(1);
  await expect(page.locator('.item')).toContainText('Rome book');
});

test('SCN-010/009: read-later vs reference and tabs', async ({ page }) => {
  await addBookmark(page, 'https://rl1.example.test', { title: 'ToRead RL', tags: 'rltag', readLater: true });
  await addBookmark(page, 'https://rl2.example.test', { title: 'Ref RL', tags: 'rltag', readLater: false });
  await page.fill('#search', '#rltag');
  await page.click('.tab[data-f="unread"]');
  await expect(page.locator('.item')).toHaveCount(1);
  await expect(page.locator('.item')).toContainText('ToRead RL');
  await page.click('.tab[data-f="done"]');
  await expect(page.locator('.item')).toContainText('Ref RL');
});

test('SCN-015/014: archive/restore and delete with confirmation', async ({ page }) => {
  await addBookmark(page, 'https://arch.example.test', { title: 'Archive Me', tags: 'archtag' });
  const item = page.locator('.item', { hasText: 'Archive Me' });
  await item.getByRole('button', { name: 'Archive' }).click();
  await page.fill('#search', '#archtag');
  await expect(page.locator('.item', { hasText: 'Archive Me' })).toHaveCount(0); // hidden from normal view
  await page.click('.tab[data-f="archived"]');
  await expect(page.locator('.item', { hasText: 'Archive Me' })).toBeVisible();
  await page.locator('.item', { hasText: 'Archive Me' }).getByRole('button', { name: 'Restore' }).click();
  // delete with confirmation
  page.on('dialog', (d) => d.accept());
  await page.click('.tab[data-f="all"]');
  await page.fill('#search', '#archtag');
  await page.locator('.item', { hasText: 'Archive Me' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.item', { hasText: 'Archive Me' })).toHaveCount(0);
});

test('SCN-016/017: bulk add tag to selected', async ({ page }) => {
  await addBookmark(page, 'https://b1.example.test', { title: 'Bulk One', tags: 'bulkgrp' });
  await addBookmark(page, 'https://b2.example.test', { title: 'Bulk Two', tags: 'bulkgrp' });
  await page.fill('#search', '#bulkgrp');
  await page.check('#selectall');
  await expect(page.locator('#bulkcount')).toContainText('2 selected');
  await page.click('button:has-text("Add tags…")');
  await page.fill('#btInput', 'added-tag');
  await page.click('#btApply');
  await page.fill('#search', '#added-tag');
  await expect(page.locator('.item')).toHaveCount(2);
});

test('SCN-018: sort by title', async ({ page }) => {
  await addBookmark(page, 'https://z.example.test', { title: 'Zeta sortitem', tags: 'sortgrp' });
  await addBookmark(page, 'https://a.example.test', { title: 'Alpha sortitem', tags: 'sortgrp' });
  await page.fill('#search', '#sortgrp');
  await page.selectOption('#sortsel', 'title_asc');
  await expect(page.locator('.item .title').first()).toContainText('Alpha sortitem');
  await page.selectOption('#sortsel', 'title_desc');
  await expect(page.locator('.item .title').first()).toContainText('Zeta sortitem');
});

test('SCN-019: note renders Markdown when opened', async ({ page }) => {
  await addBookmark(page, 'https://note.example.test', { title: 'Noted', tags: 'notegrp', note: '# Head\n**bold** text' });
  await page.fill('#search', '#notegrp');
  const item = page.locator('.item', { hasText: 'Noted' });
  await item.getByRole('button', { name: '📝 Note' }).click();
  await expect(item.locator('.noteview h3')).toHaveText('Head');
  await expect(item.locator('.noteview strong')).toHaveText('bold');
});

test('SCN-022: save and rerun a saved search', async ({ page }) => {
  await addBookmark(page, 'https://ss1.example.test', { title: 'Saved Search Item', tags: 'sstag' });
  await page.fill('#search', '#sstag');
  page.once('dialog', (d) => d.accept('My SS'));
  await page.click('#savesearch');
  await expect(page.locator('.savedchip', { hasText: 'My SS' })).toBeVisible();
  await page.fill('#search', '');
  await page.locator('.savedchip', { hasText: 'My SS' }).click();
  await expect(page.locator('#search')).toHaveValue('#sstag');
  await expect(page.locator('.item', { hasText: 'Saved Search Item' })).toBeVisible();
});

test('SCN-024: display preference limits items with Show more, whole-view select unaffected', async ({ page }) => {
  for (let i = 0; i < 12; i++) {
    await addBookmark(page, `https://pg${i}.example.test`, { title: `Page ${String(i).padStart(2, '0')} pgitem`, tags: 'pggrp' });
  }
  await page.fill('#search', '#pggrp');
  await page.click('#prefsBtn');
  await page.selectOption('#pref-page', '10');
  await expect(page.locator('.item')).toHaveCount(10);
  await expect(page.locator('.showmore')).toBeVisible();
  await page.check('#selectall');
  await expect(page.locator('#bulkcount')).toContainText('12 selected'); // covers hidden matches
});
