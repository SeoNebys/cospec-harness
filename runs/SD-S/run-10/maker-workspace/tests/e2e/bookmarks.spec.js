import { test, expect } from '@playwright/test';

// Each test starts from a clean slate by clearing storage via the API.
test.beforeEach(async ({ page, request }) => {
  const { bookmarks } = await (await request.get('/api/bookmarks')).json();
  for (const b of bookmarks) await request.delete(`/api/bookmarks/${b.id}`);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
});

async function addBookmark(page, { url, title = '', notes = '', tags = '' }, { expectError = false } = {}) {
  await page.fill('#url', url);
  await page.fill('#title', title);
  await page.fill('#notes', notes);
  await page.fill('#tags', tags);
  await page.click('#submit-btn');
  if (expectError) {
    // Invalid input: the form is not reset, an error message is shown.
    await expect(page.locator('#form-message.form__message--error')).toBeVisible();
  } else {
    // Successful save/warn resets the form (url field cleared).
    await expect(page.locator('#url')).toHaveValue('');
  }
}

test('empty state is shown before any bookmarks exist', async ({ page }) => {
  await expect(page.locator('.empty-state')).toContainText('No bookmarks yet');
});

test('US1: save a bookmark, normalized and persisted; invalid url rejected', async ({ page }) => {
  await addBookmark(page, { url: 'example.com', title: 'Example Site' });
  const item = page.locator('.bookmark').filter({ hasText: 'Example Site' });
  await expect(item).toBeVisible();
  await expect(item.locator('.bookmark__url')).toHaveText('https://example.com/');

  // Invalid input is rejected with a message and no new item.
  await addBookmark(page, { url: 'not a url' }, { expectError: true });
  await expect(page.locator('#form-message')).toContainText('valid web address');
  await expect(page.locator('.bookmark')).toHaveCount(1);

  // Persists after reload.
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('.bookmark').filter({ hasText: 'Example Site' })).toBeVisible();
});

test('US2: search filters, and no-results message shows', async ({ page }) => {
  await addBookmark(page, { url: 'https://alpha.com', title: 'Alpha' });
  await addBookmark(page, { url: 'https://beta.com', title: 'Beta' });
  await expect(page.locator('.bookmark')).toHaveCount(2);

  await page.fill('#search', 'alpha');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark')).toContainText('Alpha');

  await page.fill('#search', 'zzz');
  await expect(page.locator('.empty-state')).toContainText('No bookmarks match');
});

test('US2: bookmark link opens the address in a new tab', async ({ page }) => {
  await addBookmark(page, { url: 'https://example.com', title: 'Example' });
  const link = page.locator('.bookmark__title a');
  await expect(link).toHaveAttribute('href', 'https://example.com/');
  await expect(link).toHaveAttribute('target', '_blank');
});

test('US3: edit persists and delete requires confirmation', async ({ page }) => {
  await addBookmark(page, { url: 'https://edit.com', title: 'Before' });

  await page.locator('.bookmark').filter({ hasText: 'Before' }).getByRole('button', { name: 'Edit' }).click();
  await page.fill('#title', 'After');
  await page.click('#submit-btn');
  await expect(page.locator('.bookmark').filter({ hasText: 'After' })).toBeVisible();

  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('.bookmark').filter({ hasText: 'After' })).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await page.locator('.bookmark').filter({ hasText: 'After' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.bookmark')).toHaveCount(0);
});

test('US4: tag two bookmarks and filter by tag', async ({ page }) => {
  await addBookmark(page, { url: 'https://one.com', title: 'One', tags: 'work' });
  await addBookmark(page, { url: 'https://two.com', title: 'Two', tags: 'work' });
  await addBookmark(page, { url: 'https://three.com', title: 'Three', tags: 'personal' });
  await expect(page.locator('.bookmark')).toHaveCount(3);

  await page.selectOption('#tag-filter', 'work');
  await expect(page.locator('.bookmark')).toHaveCount(2);
});

test('duplicate url produces a non-blocking warning but still saves', async ({ page }) => {
  await addBookmark(page, { url: 'https://dup.com', title: 'First' });
  await addBookmark(page, { url: 'https://dup.com', title: 'Second' });
  await expect(page.locator('#form-message')).toContainText('already uses this address');
  await expect(page.locator('.bookmark')).toHaveCount(2);
});
