const { test, expect } = require('@playwright/test');

const fixtureUrl = 'http://127.0.0.1:4000/fixtures/article';
const missingDetailsUrl = 'http://127.0.0.1:4000/fixtures/no-details';

async function openClean(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function saveFixture(page, url = fixtureUrl) {
  await page.locator('#save-url').fill(url);
  await page.getByRole('button', { name: /Save bookmark/ }).click();
  await expect(page.locator('.bookmark')).toHaveCount(1);
}

async function seed(page, items) {
  await page.addInitScript(value => localStorage.setItem('keepsake.bookmarks.v1', JSON.stringify(value)), items);
  await page.goto('/');
}

function bookmark(overrides = {}) {
  return { id: crypto.randomUUID(), url: fixtureUrl, title: 'JavaScript | MDN', description: 'A language reference.', tags: [], readLater: false, archived: false, createdAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

test.describe('SCN-001 and SCN-006 — saving', () => {
  test('saves one address with fetched title, description, and original address', async ({ page }) => {
    await openClean(page); await saveFixture(page);
    const card = page.locator('.bookmark');
    await expect(card.getByRole('heading')).toHaveText('JavaScript | MDN');
    await expect(card.locator('.description')).toContainText('dynamically updating content');
    await expect(card.locator('.address')).toHaveText(fixtureUrl);
  });

  test('rejects malformed input and preserves the open saving control', async ({ page }) => {
    await openClean(page);
    await page.locator('#save-url').fill('not-a-link');
    await page.getByRole('button', { name: /Save bookmark/ }).click();
    await expect(page.locator('#save-status')).toContainText('complete web address');
    await expect(page.locator('.bookmark')).toHaveCount(0);
    await expect(page.locator('#save-url')).toHaveValue('not-a-link');
  });

  test('uses a hostname fallback when metadata is unavailable', async ({ page }) => {
    await openClean(page); await saveFixture(page, missingDetailsUrl);
    await expect(page.locator('.bookmark h3')).toHaveText('127.0.0.1');
    await expect(page.locator('.bookmark .description')).toContainText('details unavailable');
    await expect(page.locator('#save-status')).toContainText('could not be retrieved');
  });

  test('does not duplicate an existing address and highlights it', async ({ page }) => {
    await openClean(page); await saveFixture(page);
    await page.locator('#save-url').fill(`${fixtureUrl}/`);
    await page.getByRole('button', { name: /Save bookmark/ }).click();
    await expect(page.locator('.bookmark')).toHaveCount(1);
    await expect(page.locator('.bookmark')).toHaveClass(/highlight/);
    await expect(page.locator('#save-status')).toContainText('already saved');
  });
});

test.describe('SCN-002 and SCN-007 — tags', () => {
  test('adds a visible tag and rejects a case-insensitive duplicate', async ({ page }) => {
    await openClean(page); await saveFixture(page);
    await page.getByRole('button', { name: 'Add a tag' }).click();
    await page.getByLabel('Tag name').fill('javascript');
    await page.locator('.tag-editor button').click();
    await expect(page.locator('.tag')).toHaveText('javascript');
    await page.getByRole('button', { name: 'Add a tag' }).click();
    await page.getByLabel('Tag name').fill('JavaScript');
    await page.locator('.tag-editor button').click();
    await expect(page.locator('.tag')).toHaveCount(1);
    await expect(page.locator('#save-status')).toContainText('already has that tag');
  });
});

test.describe('SCN-003 and SCN-008 — search and empty views', () => {
  test('searches titles and tags as the user types and explains no matches', async ({ page }) => {
    await seed(page, [bookmark(), bookmark({ id:'pasta', url:'https://kitchen.example/pasta', title:'Five easy pasta recipes', tags:['cooking'] })]);
    await page.getByLabel('Search titles and tags').fill('JavaScript');
    await expect(page.locator('.bookmark')).toHaveCount(1); await expect(page.locator('.bookmark h3')).toHaveText('JavaScript | MDN');
    await page.getByLabel('Search titles and tags').fill('cooking');
    await expect(page.locator('.bookmark h3')).toHaveText('Five easy pasta recipes');
    await page.getByLabel('Search titles and tags').fill('astronomy');
    await expect(page.locator('#empty')).toBeVisible(); await expect(page.locator('#empty')).toContainText('No bookmarks match');
    await expect(page.getByLabel('Search titles and tags')).toBeVisible();
  });

  test('explains empty reading-list and archive views', async ({ page }) => {
    await seed(page, [bookmark()]);
    await page.getByRole('button', { name:/Read later 0/ }).click(); await expect(page.locator('#empty')).toContainText('reading list is empty');
    await page.getByRole('button', { name:/Archive 0/ }).click(); await expect(page.locator('#empty')).toContainText('archive is empty');
  });
});

test('SCN-004 — marks an item and shows it alone in Read later', async ({ page }) => {
  await seed(page, [bookmark(), bookmark({ id:'pasta', url:'https://kitchen.example/pasta', title:'Pasta recipes' })]);
  const mdn = page.locator('.bookmark').filter({ hasText:'JavaScript | MDN' });
  await mdn.getByRole('button', { name:'Read later' }).click();
  await expect(page.locator('.bookmark').filter({ hasText:'JavaScript | MDN' }).getByRole('button', { name:/In reading list/ })).toBeVisible();
  await page.getByRole('button', { name:/Read later 1/ }).click();
  await expect(page.locator('.bookmark')).toHaveCount(1); await expect(page.locator('.bookmark h3')).toHaveText('JavaScript | MDN');
});

test.describe('SCN-005 and SCN-009 — management', () => {
  test('edits valid details and rejects an invalid replacement address', async ({ page }) => {
    await seed(page, [bookmark()]);
    await page.getByRole('button', { name:'Manage' }).click(); await page.getByRole('button', { name:'Edit' }).click();
    await page.locator('#edit-title').fill('MDN JavaScript Guide'); await page.locator('#edit-url').fill('not-a-link');
    await page.getByRole('button', { name:'Save changes' }).click();
    await expect(page.locator('#edit-dialog')).toBeVisible(); await expect(page.locator('#edit-status')).toContainText('complete web address');
    await page.locator('#edit-url').fill('https://developer.mozilla.org/javascript'); await page.getByRole('button', { name:'Save changes' }).click();
    await expect(page.locator('.bookmark h3')).toHaveText('MDN JavaScript Guide'); await expect(page.locator('.address')).toHaveText('https://developer.mozilla.org/javascript');
  });

  test('archives and restores a bookmark', async ({ page }) => {
    await seed(page, [bookmark()]);
    await page.getByRole('button', { name:'Manage' }).click(); await page.getByRole('button', { name:'Archive', exact:true }).click();
    await expect(page.locator('.bookmark')).toHaveCount(0); await page.getByRole('button', { name:/Archive 1/ }).click(); await expect(page.locator('.bookmark')).toHaveCount(1);
    await page.getByRole('button', { name:'Restore' }).click(); await expect(page.locator('.bookmark')).toHaveCount(0); await page.getByRole('button', { name:/All 1/ }).click(); await expect(page.locator('.bookmark')).toHaveCount(1);
  });

  test('cancel keeps a bookmark and confirmation permanently deletes it', async ({ page }) => {
    await seed(page, [bookmark()]);
    await page.getByRole('button', { name:'Manage' }).click(); await page.getByRole('button', { name:'Delete' }).click(); await page.getByRole('button', { name:'Keep bookmark' }).click();
    await expect(page.locator('.bookmark')).toHaveCount(1);
    await page.getByRole('button', { name:'Manage' }).click(); await page.getByRole('button', { name:'Delete' }).click(); await page.getByRole('button', { name:'Delete permanently' }).click();
    await expect(page.locator('.bookmark')).toHaveCount(0); await page.getByRole('button', { name:/Archive 0/ }).click(); await expect(page.locator('.bookmark')).toHaveCount(0);
  });
});

test('SCN-010 — long titles clamp while the full address remains', async ({ page }) => {
  const title = 'A comprehensive field guide to organizing finding revisiting and preserving useful research from across the entire web';
  const url = 'https://knowledge.example/library/a/very/long/path/that/remains/available?edition=complete&source=reading-list';
  await seed(page, [bookmark({ title, url })]);
  await expect(page.locator('.bookmark h3')).toHaveCSS('-webkit-line-clamp', '2'); await expect(page.locator('.address')).toHaveText(url);
});

test('SCN-011 — captured metadata remains stable across reloads until edited', async ({ page }) => {
  await page.goto('/'); await page.evaluate(value => localStorage.setItem('keepsake.bookmarks.v1', JSON.stringify(value)), [bookmark({ title:'The title I recognize' })]); await page.reload(); await expect(page.locator('.bookmark h3')).toHaveText('The title I recognize');
  await page.getByRole('button', { name:'Manage' }).click(); await page.getByRole('button', { name:'Edit' }).click(); await page.locator('#edit-title').fill('My edited title'); await page.getByRole('button', { name:'Save changes' }).click();
  await page.reload(); await expect(page.locator('.bookmark h3')).toHaveText('My edited title');
});
