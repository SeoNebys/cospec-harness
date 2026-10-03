import { test, expect } from '@playwright/test';

function fixtureUrl(title, description = 'A useful saved page.') {
  return `http://127.0.0.1:4100/__fixtures/page?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
}

async function resetAndOpen(page, request) {
  await request.post('/__fixtures/reset');
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
}

async function seed(request, input) {
  const response = await request.post('/api/bookmarks', {
    data: {
      url: input.url,
      title: input.title,
      description: input.description || '',
      labels: input.labels || [],
      readLater: input.readLater || false,
      archived: input.archived || false
    }
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).bookmark;
}

async function saveFromAddress(page, address, { title, description } = {}) {
  await page.locator('#openSave').click();
  await page.locator('#saveUrl').fill(address);
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.locator('#saveReviewStep')).toBeVisible();
  if (title !== undefined) await page.locator('#saveTitle').fill(title);
  if (description !== undefined) await page.locator('#saveDescription').fill(description);
  await page.getByRole('button', { name: 'Save bookmark' }).click();
}

async function waitForList(page) {
  await expect(page.locator('.collection')).toHaveAttribute('aria-busy', 'false');
}

test.beforeEach(async ({ page, request }) => {
  await resetAndOpen(page, request);
});

test('SCN-001 saves readable details and opens the original page directly', async ({ page }) => {
  const address = fixtureUrl('Crispy Roast Potatoes', 'Crunchy outside with creamy centers.');
  await saveFromAddress(page, address);
  const row = page.locator('.bookmark-row');
  await expect(row.getByText('Crispy Roast Potatoes')).toBeVisible();
  await expect(row.getByText('Crunchy outside with creamy centers.')).toBeVisible();
  await expect(row.getByText('127.0.0.1')).toBeVisible();
  await expect(row.locator('.bookmark-open')).toHaveAttribute('href', address);
  const popupPromise = page.waitForEvent('popup');
  await row.locator('.bookmark-open').click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(decodeURIComponent(popup.url())).toContain('Crispy Roast Potatoes');
});

test('SCN-002 reviews and corrects details before saving', async ({ page }) => {
  await saveFromAddress(page, fixtureUrl('Ugly | Site Title', 'Generated description'), {
    title: 'My useful title',
    description: 'My useful description'
  });
  const row = page.locator('.bookmark-row');
  await expect(row.getByText('My useful title')).toBeVisible();
  await expect(row.getByText('My useful description')).toBeVisible();
});

test('SCN-003 edits title, description, and address while preserving the destination behavior', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/old', title: 'Old title', description: 'Old description' });
  await page.reload();
  await page.getByRole('button', { name: 'Edit Old title' }).click();
  await page.locator('#editUrl').fill('https://new.example.org/moved');
  await page.locator('#editTitle').fill('New title');
  await page.locator('#editDescription').fill('New description');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const row = page.locator('.bookmark-row');
  await expect(row.getByText('New title')).toBeVisible();
  await expect(row.getByText('New description')).toBeVisible();
  await expect(row.getByText('new.example.org')).toBeVisible();
  await expect(row.locator('.bookmark-open')).toHaveAttribute('href', 'https://new.example.org/moved');
});

test('SCN-004 filters the collection using a counted sidebar label', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/potatoes', title: 'Potatoes', labels: ['Recipes'] });
  await seed(request, { url: 'https://example.com/cake', title: 'Carrot cake', labels: ['Recipes'] });
  await seed(request, { url: 'https://example.com/guide', title: 'Work guide', labels: ['Work'] });
  await page.reload();
  const recipes = page.locator('[data-label="Recipes"]');
  await expect(recipes.locator('.nav-count')).toHaveText('2');
  await recipes.click();
  await expect(page.locator('.bookmark-row')).toHaveCount(2);
  await expect(page.locator('#viewSummary')).toContainText('2 bookmarks found');
});

test('SCN-005 suggests, adds, combines, and removes labels independently', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/seed-work', title: 'Work seed', labels: ['Work'] });
  const target = await seed(request, { url: 'https://example.com/lunch', title: 'Team lunch' });
  await page.reload();
  await page.getByRole('button', { name: 'Edit Team lunch' }).click();
  await page.locator('#labelInput').fill('wor');
  await expect(page.locator('[data-suggestion="Work"]')).toBeVisible();
  await page.locator('[data-suggestion="Work"]').click();
  await page.locator('#labelInput').fill('recipes');
  await page.locator('#labelInput').press('Enter');
  await expect(page.locator('#selectedLabels .selected-chip')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Edit Team lunch' }).click();
  await page.getByRole('button', { name: 'Remove Recipes' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  const response = await request.get(`/api/bookmarks/${target.id}`);
  expect((await response.json()).bookmark.labels).toEqual(['Work']);
});

test('SCN-006 supports plain, label, phrase, exclusion, OR, and implicit-AND searches', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/potatoes', title: 'Roast potatoes', description: 'Crunchy with creamy centers', labels: ['Recipes'] });
  await seed(request, { url: 'https://example.com/cake', title: 'Carrot cake', description: 'A creamy cake with soft centers', labels: ['Recipes'] });
  await seed(request, { url: 'https://example.com/work', title: 'Work guide', labels: ['Work'] });
  await page.reload();
  const search = page.getByLabel('Search bookmarks');
  for (const [query, count] of [
    ['CREAMY', 2],
    ['label:recipes', 2],
    ['"creamy centers"', 1],
    ['label:recipes -carrot', 1],
    ['label:recipes OR label:work', 3],
    ['potatoes label:recipes', 1]
  ]) {
    await search.fill(query);
    await expect(page.locator('.bookmark-row')).toHaveCount(count);
  }
});

test('SCN-007 adds to Read later and marks an item read without deleting it', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/guide', title: 'JavaScript Guide' });
  await page.reload();
  await page.getByLabel('Add JavaScript Guide to Read later').click();
  await expect(page.locator('#laterCount')).toHaveText('1');
  await page.locator('[data-view="read-later"]').click();
  await page.getByLabel('Mark JavaScript Guide as read').click();
  await expect(page.getByText("You're all caught up")).toBeVisible();
  await page.locator('[data-view="all"]').click();
  await expect(page.getByText('JavaScript Guide')).toBeVisible();
});

test('SCN-008 archives, scopes search, and restores the unchanged item', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/design', title: 'Designing Better Systems', description: 'Original description', labels: ['Work'] });
  await page.reload();
  await page.getByLabel('Archive Designing Better Systems').click();
  await expect(page.locator('#archiveCount')).toHaveText('1');
  await page.getByLabel('Search bookmarks').fill('Designing');
  await expect(page.getByText('No bookmarks found')).toBeVisible();
  await page.locator('[data-view="archive"]').click();
  await expect(page.getByText('Designing Better Systems')).toBeVisible();
  await page.getByLabel('Restore Designing Better Systems').click();
  await page.locator('[data-view="all"]').click();
  await expect(page.getByText('Designing Better Systems')).toBeVisible();
  await expect(page.getByText('Original description')).toBeVisible();
  await expect(page.locator('#archiveCount')).toHaveText('0');
});

test('SCN-009 permanently deletes only after confirmation and never archives', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/delete', title: 'Delete me' });
  await page.reload();
  await page.getByRole('button', { name: 'Edit Delete me' }).click();
  await page.getByRole('button', { name: 'Delete bookmark' }).click();
  await expect(page.getByText('this action cannot be undone', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByText('Save your first find')).toBeVisible();
  await expect(page.locator('#archiveCount')).toHaveText('0');
});

test('SCN-010 locates an exact duplicate without increasing the count', async ({ page, request }) => {
  const url = 'https://example.com/existing';
  await seed(request, { url, title: 'Existing bookmark' });
  await page.reload();
  await page.locator('#openSave').click();
  await page.locator('#saveUrl').fill(url);
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.locator('.bookmark-row')).toHaveClass(/focused/);
  await expect(page.locator('#allCount')).toHaveText('1');
  await expect(page.getByText('Already saved — here it is in your collection')).toBeVisible();
});

test('SCN-011 keeps invalid input in place and creates no bookmark', async ({ page }) => {
  await page.locator('#openSave').click();
  await page.locator('#saveUrl').fill('not a link');
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.locator('#saveUrlError')).toContainText('full web address');
  await expect(page.locator('#saveUrl')).toHaveValue('not a link');
  await expect(page.locator('#saveDialog')).toBeVisible();
  await expect(page.locator('#allCount')).toHaveText('0');
});

test('SCN-012 falls back to manual details when metadata is unavailable', async ({ page }) => {
  await page.locator('#openSave').click();
  await page.locator('#saveUrl').fill('/__fixtures/unavailable');
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.locator('#saveUrlError')).toContainText('full web address');
  await page.locator('#saveUrl').fill('http://127.0.0.1:4100/__fixtures/unavailable');
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.getByText('Page details unavailable')).toBeVisible();
  await page.locator('#saveTitle').fill('Private research notes');
  await page.locator('#saveDescription').fill('A page I still want to keep.');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('Private research notes')).toBeVisible();
});

test('SCN-013 explains no results and clear restores the collection', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/one', title: 'One bookmark' });
  await page.reload();
  await page.getByLabel('Search bookmarks').fill('volcano');
  await expect(page.getByText('No bookmarks found')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByText('One bookmark')).toBeVisible();
});

test('SCN-014 creates a new label only after Enter and tidies capitalization', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/plan', title: 'Planning bookmark' });
  await page.reload();
  await page.getByRole('button', { name: 'Edit Planning bookmark' }).click();
  await page.locator('#labelInput').fill('planning');
  await expect(page.locator('#selectedLabels .selected-chip')).toHaveCount(0);
  await page.locator('#labelInput').press('Enter');
  await expect(page.locator('#selectedLabels')).toContainText('Planning');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('[data-label="Planning"] .nav-count')).toHaveText('1');
});

test('SCN-015 requires title while permitting an empty description', async ({ page }) => {
  await page.locator('#openSave').click();
  await page.locator('#saveUrl').fill(fixtureUrl('Generated title'));
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.locator('#saveReviewStep')).toBeVisible();
  await page.locator('#saveTitle').fill('');
  await page.locator('#saveDescription').fill('');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.locator('#saveTitleError')).toContainText('Add a title');
  await page.locator('#saveTitle').fill('Named bookmark');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('Named bookmark')).toBeVisible();
});

test('SCN-016 ignores tracking parameters and preserves the clean saved address', async ({ page, request }) => {
  const clean = 'https://example.com/article';
  await seed(request, { url: clean, title: 'Clean bookmark' });
  await page.reload();
  await page.locator('#openSave').click();
  await page.locator('#saveUrl').fill(`${clean}?utm_source=email&utm_campaign=weekly`);
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.locator('#allCount')).toHaveText('1');
  await expect(page.locator('.bookmark-open')).toHaveAttribute('href', clean);
  await expect(page.getByText('tracking text was ignored', { exact: false })).toBeVisible();
});

test('SCN-017 visually truncates long details but preserves their complete edit values', async ({ page, request }) => {
  const title = 'An exceptionally thorough title about planning and preparing everything for a very long family gathering with many details';
  const description = 'A very long description with timing notes, substitutions, serving ideas, and enough additional text to exceed the list row.';
  await seed(request, { url: 'https://example.com/long', title, description });
  await page.reload();
  const row = page.locator('.bookmark-row');
  expect((await row.boundingBox()).height).toBeLessThan(145);
  await page.getByRole('button', { name: `Edit ${title}` }).click();
  await expect(page.locator('#editTitle')).toHaveValue(title);
  await expect(page.locator('#editDescription')).toHaveValue(description);
});

test('SCN-018 keeps the collection while an exact phrase is unfinished', async ({ page, request }) => {
  await seed(request, { url: 'https://example.com/a', title: 'Bookmark A' });
  await seed(request, { url: 'https://example.com/b', title: 'Bookmark B' });
  await page.reload();
  await page.getByLabel('Search bookmarks').fill('"unfinished phrase');
  await expect(page.locator('#searchMessage')).toContainText('closing quotation mark');
  await expect(page.locator('.bookmark-row')).toHaveCount(2);
});

test('SCN-019 appends twenty more bookmarks to one continuous list', async ({ page, request }) => {
  for (let index = 1; index <= 45; index += 1) {
    await seed(request, { url: `https://example.com/item-${index}`, title: `Bookmark ${index}` });
  }
  await page.reload();
  await expect(page.locator('.bookmark-row')).toHaveCount(20);
  await expect(page.locator('#shownCount')).toHaveText('Showing 20 of 45');
  await page.getByRole('button', { name: 'Show 20 more' }).click();
  await expect(page.locator('.bookmark-row')).toHaveCount(40);
  await expect(page.locator('#shownCount')).toHaveText('Showing 40 of 45');
});

test('SCN-020 retains saved details when the external page is unavailable', async ({ page, request }) => {
  const bookmark = await seed(request, {
    url: 'http://127.0.0.1:4100/__fixtures/unavailable',
    title: 'Unavailable but retained',
    description: 'My stored description',
    labels: ['Research']
  });
  await page.reload();
  const popupPromise = page.waitForEvent('popup');
  await page.locator('.bookmark-open').click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(await popup.locator('body').innerText()).toContain('Unavailable');
  await page.reload();
  await expect(page.getByText('Unavailable but retained')).toBeVisible();
  await expect(page.getByText('My stored description')).toBeVisible();
  const response = await request.get(`/api/bookmarks/${bookmark.id}`);
  expect((await response.json()).bookmark.labels).toEqual(['Research']);
});
