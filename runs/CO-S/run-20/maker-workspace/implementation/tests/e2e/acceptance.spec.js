import { test, expect } from '@playwright/test';

// Acceptance tests derived from the approved scenarios (SCN-001..SCN-009).
// Metadata lookups are stubbed so the tests are hermetic: a "*.test" host or an
// "unreachable" host simulates a page whose details can't be read (SCN-006);
// everything else returns a deterministic title/description.

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/_test/reset');
  await page.route('**/api/metadata', async (route) => {
    const { url } = route.request().postDataJSON();
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (host.endsWith('.test') || host.includes('unreachable')) {
      await route.fulfill({ json: { ok: false } });
      return;
    }
    await route.fulfill({
      json: {
        ok: true,
        title: `Title for ${host}`,
        description: `Description for ${host}`,
        favicon: '',
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
});

async function addBookmark(page, { url, title, note, topics = [] }) {
  await page.fill('#url', url);
  await expect(page.locator('#saveBtn')).toBeEnabled();
  if (title !== undefined) await page.fill('#title', title);
  if (note !== undefined) await page.fill('#note', note);
  for (const t of topics) {
    await page.fill('#topicInput', t);
    await page.press('#topicInput', 'Enter');
  }
  await page.click('#saveBtn');
  // Wait for the successful-create reset so the next action can't race it.
  await expect(page.locator('#url')).toHaveValue('');
}

test('SCN-001: save a link with auto-filled details; newest appears first', async ({ page }) => {
  await page.fill('#url', 'https://example.com/first');
  await expect(page.locator('#saveBtn')).toBeEnabled();
  await expect(page.locator('#title')).toHaveValue('Title for example.com'); // filled before save
  await expect(page.locator('#description')).toHaveValue('Description for example.com');
  await page.click('#saveBtn');
  await expect(page.locator('#url')).toHaveValue('');

  await addBookmark(page, { url: 'https://second.com/post' });

  const items = page.locator('#list .item');
  await expect(items).toHaveCount(2);
  // newest (second.com) first
  await expect(items.first().locator('.title-line a')).toHaveText('Title for second.com');
  await expect(items.first().locator('.url')).toContainText('https://second.com/post');
  await expect(items.first().locator('.meta')).toContainText('Saved');
});

test('SCN-001/SCN-002: personal note is stored separately and is searchable', async ({ page }) => {
  await addBookmark(page, { url: 'https://recipes.com/stew', note: 'make this in spring' });
  await expect(page.locator('#list .note')).toContainText('make this in spring');

  await page.fill('#search', 'spring'); // only in the note
  await expect(page.locator('#list .item')).toHaveCount(1);
  await expect(page.locator('#list mark')).toHaveText('spring');
});

test('SCN-002: live search filters, highlights, and shows a no-match message', async ({ page }) => {
  await addBookmark(page, { url: 'https://alpha.com/a', title: 'Alpha Article' });
  await addBookmark(page, { url: 'https://beta.com/b', title: 'Beta Article' });

  await page.fill('#search', 'alpha');
  await expect(page.locator('#list .item')).toHaveCount(1);
  await expect(page.locator('#list .item .title-line a')).toHaveText(/Alpha/);

  await page.fill('#search', 'zzz');
  await expect(page.locator('#list .item')).toHaveCount(0);
  await expect(page.locator('#list .empty')).toContainText('No links match');

  await page.fill('#search', '');
  await expect(page.locator('#list .item')).toHaveCount(2);
});

test('SCN-003: several topics per link; filter by topic and combine with search', async ({ page }) => {
  await addBookmark(page, { url: 'https://c.com/chicken', title: 'Chicken', topics: ['Cooking', 'Weeknight'] });
  await addBookmark(page, { url: 'https://c.com/salad', title: 'Salad', topics: ['Cooking'] });
  await addBookmark(page, { url: 'https://d.com/css', title: 'CSS', topics: ['Programming'] });

  await expect(page.locator('#list .item', { hasText: 'Chicken' }).locator('.topic-tag')).toHaveCount(2);

  await page.getByRole('button', { name: 'Weeknight', exact: true }).click();
  await expect(page.locator('#list .item')).toHaveCount(1);
  await expect(page.locator('#list .title-line a')).toHaveText('Chicken');

  // topic + search combine
  await page.getByRole('button', { name: 'Cooking', exact: true }).click();
  await expect(page.locator('#list .item')).toHaveCount(2);
  await page.fill('#search', 'salad');
  await expect(page.locator('#list .item')).toHaveCount(1);
});

test('SCN-004: reading queue — new links start to-read; mark read; filter', async ({ page }) => {
  await addBookmark(page, { url: 'https://r.com/one', title: 'One' });
  await expect(page.locator('#list .item .badge')).toHaveText('To read');

  await page.getByRole('button', { name: 'To read', exact: true }).click();
  await expect(page.locator('#list .item')).toHaveCount(1);

  await page.getByRole('button', { name: 'Mark as read' }).click();
  // now the "To read" queue is empty
  await expect(page.locator('#list .empty')).toContainText('reading queue is clear');

  await page.getByRole('button', { name: 'Read', exact: true }).click();
  await expect(page.locator('#list .item .badge')).toHaveText('Read');
});

test('SCN-005: archive removes from collection but stays in a searchable archive; restore', async ({ page }) => {
  await addBookmark(page, { url: 'https://keep.com/ref', title: 'Reference' });
  await addBookmark(page, { url: 'https://daily.com/news', title: 'Daily' });

  await page.locator('#list .item', { hasText: 'Reference' }).getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('#list .item')).toHaveCount(1); // gone from collection

  // not in the collection's search
  await page.fill('#search', 'Reference');
  await expect(page.locator('#list .item')).toHaveCount(0);
  await page.fill('#search', '');

  await expect(page.locator('#archiveToggle')).toContainText('(1)');
  await page.click('#archiveToggle');
  await expect(page.locator('#listHeading')).toHaveText('Archived links');
  await expect(page.locator('#list .item')).toHaveCount(1);
  await page.fill('#search', 'Reference'); // searchable within the archive
  await expect(page.locator('#list .item')).toHaveCount(1);
  await page.fill('#search', '');

  await page.getByRole('button', { name: 'Restore to collection' }).click();
  await page.click('#archiveToggle'); // back to collection
  await expect(page.locator('#list .item')).toHaveCount(2);
});

test('SCN-006: unreadable page can still be saved with a manual title', async ({ page }) => {
  await page.fill('#url', 'https://unreachable.invalid/page');
  await expect(page.locator('#fieldStatus')).toContainText("Couldn't read this page");
  await expect(page.locator('#saveBtn')).toBeEnabled();
  await page.fill('#title', 'My manual title');
  await page.click('#saveBtn');
  await expect(page.locator('#list .title-line a')).toHaveText('My manual title');
});

test('SCN-006: an incomplete address keeps saving disabled', async ({ page }) => {
  await page.fill('#url', 'not a link');
  await expect(page.locator('#saveBtn')).toBeDisabled();
});

test('SCN-007: empty collection shows a friendly message', async ({ page }) => {
  await expect(page.locator('#list .empty')).toContainText('No links saved yet');
});

test('SCN-008: edit updates the same link with no duplicate; cancel leaves it', async ({ page }) => {
  await addBookmark(page, { url: 'https://e.com/x', title: 'Original' });
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#saveHeading')).toHaveText('Edit link');
  await page.fill('#title', 'Edited Title');
  await page.click('#saveBtn'); // "Update"
  await expect(page.locator('#list .item')).toHaveCount(1);
  await expect(page.locator('#list .title-line a')).toHaveText('Edited Title');
});

test('SCN-008: delete asks for confirmation and removes permanently', async ({ page }) => {
  await addBookmark(page, { url: 'https://del.com/x', title: 'Delete Me' });
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#list .empty')).toContainText('No links saved yet');
});

test('SCN-009: saving a duplicate opens the existing link instead of copying', async ({ page }) => {
  await addBookmark(page, { url: 'https://dup.com/a', title: 'The One' });
  // try to save the same address again (trailing slash + different case)
  await page.fill('#url', 'HTTPS://dup.com/a/');
  await expect(page.locator('#saveBtn')).toBeEnabled();
  await page.click('#saveBtn');

  await expect(page.locator('#fieldStatus')).toContainText('already saved');
  await expect(page.locator('#saveHeading')).toHaveText('Edit link');
  await expect(page.locator('#list .item')).toHaveCount(1); // no second copy
});
