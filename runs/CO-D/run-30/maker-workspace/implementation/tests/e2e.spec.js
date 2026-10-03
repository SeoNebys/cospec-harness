import { test, expect } from 'playwright/test';

const potatoUrl = 'https://www.seriouseats.com/roast-potatoes';

test.beforeEach(async ({ request }) => {
  const records = [];
  for (const view of ['active', 'archived']) {
    const response = await request.get(`/api/bookmarks?view=${view}`);
    const body = await response.json();
    records.push(...body.items);
  }
  for (const bookmark of records) await request.delete(`/api/bookmarks/${bookmark.id}`);
});

async function addBookmark(page, { url, title, label, labels = [], later = false }) {
  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Web address').fill(url);
  await expect(page.locator('#bookmark-fields')).toBeVisible();
  await page.getByLabel('Title').fill(title);
  for (const requestedLabel of label ? [label] : labels) {
    const label = requestedLabel;
    const existing = page.locator('#label-options .label-option').filter({ hasText: label });
    if (await existing.count()) await existing.click();
    else {
      await page.locator('#new-label').fill(label);
      await page.getByRole('button', { name: 'Create & add' }).click();
    }
  }
  if (later) await page.getByLabel('Read later').check();
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.locator('#bookmark-dialog')).toBeHidden();
}

test('organization features remain consistent through a full collection journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No bookmarks yet' })).toBeVisible();
  await expect(page.locator('#library-controls')).toBeHidden();

  await addBookmark(page, { url: potatoUrl, title: 'My saved roast potatoes', labels: ['Recipes', 'Weekend plans'], later: true });
  await addBookmark(page, { url: 'https://example.com/color-palettes', title: 'Making Sense of Color Palettes', label: 'Work' });
  await addBookmark(page, { url: 'https://example.com/kyoto', title: 'Planning a Long Weekend in Kyoto', label: 'Travel' });
  await expect(page.locator('.bookmark-card')).toHaveCount(3);
  await expect(page.locator('#result-count')).toHaveText('3 saved');

  const paletteBeforeBulk = page.locator('.bookmark-card').filter({ hasText: 'Making Sense of Color Palettes' });
  await paletteBeforeBulk.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#new-label').fill('recipes');
  await page.getByRole('button', { name: 'Create & add' }).click();
  await expect(page.locator('#label-notice')).toContainText('Used your existing “Recipes” label');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(paletteBeforeBulk.locator('.card-label').filter({ hasText: /^Recipes$/ })).toHaveCount(1);
  await expect(paletteBeforeBulk.locator('.card-label').filter({ hasText: /^Work$/ })).toHaveCount(1);

  await paletteBeforeBulk.getByLabel('Read later').check();
  await page.getByRole('tab', { name: 'Read later' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(2);
  await expect(page.locator('#result-count')).toHaveText('2 results');
  await expect(page.locator('#search-input')).toBeVisible();
  await page.locator('.bookmark-card').filter({ hasText: 'Making Sense of Color Palettes' }).getByLabel('Read later').uncheck();
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
  await expect(page.locator('#result-count')).toHaveText('1 result');
  await page.getByRole('tab', { name: 'Collection' }).click();

  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Web address').fill(`${potatoUrl}?utm_source=newsletter#method`);
  await expect(page.locator('#dialog-eyebrow')).toHaveText('Already saved');
  await expect(page.getByLabel('Title')).toHaveValue('My saved roast potatoes');
  await page.getByLabel('Title').fill('My saved fluffy potatoes');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(3);
  await expect(page.locator('.bookmark-card').filter({ hasText: 'My saved fluffy potatoes' })).toHaveCount(1);

  await page.locator('#search-input').fill('FLUFFY');
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
  await expect(page.locator('.card-title')).toHaveText('My saved fluffy potatoes');
  await page.locator('#search-clear').click();
  await expect(page.locator('.bookmark-card')).toHaveCount(3);
  await page.locator('#search-input').fill('moon cheese');
  await expect(page.getByRole('heading', { name: 'No bookmarks found' })).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('0 results');
  await page.locator('#empty-action').click();

  await page.getByRole('button', { name: 'Recipes' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(2);
  await expect(page.locator('#result-count')).toHaveText('2 results');
  await page.getByRole('button', { name: 'All labels' }).click();

  const potato = page.locator('.bookmark-card').filter({ hasText: 'My saved fluffy potatoes' });
  await potato.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Web address').fill(`${potatoUrl}?utm_medium=email#ingredients`);
  await expect(page.locator('#archived-notice')).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('My saved fluffy potatoes');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Archived' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#archived-notice')).toBeVisible();
  await page.getByLabel('Title').fill('My archived roast potatoes');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.card-title')).toHaveText('My archived roast potatoes');
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing archived' })).toBeVisible();

  await page.getByRole('tab', { name: 'Collection' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Select items' }).click();
  const palette = page.locator('.bookmark-card').filter({ hasText: 'Making Sense of Color Palettes' });
  const kyoto = page.locator('.bookmark-card').filter({ hasText: 'Planning a Long Weekend in Kyoto' });
  const restoredPotato = page.locator('.bookmark-card').filter({ hasText: 'My archived roast potatoes' });
  await restoredPotato.getByLabel('Select').check();
  await kyoto.getByLabel('Select').check();
  await expect(page.locator('#selected-count')).toHaveText('2 selected');
  await page.locator('#bulk-label').click();
  await page.locator('#bulk-label-options .bulk-label-choice').filter({ hasText: /^Work$/ }).click();
  await page.locator('#apply-bulk-label').click();
  await expect(page.locator('#selected-count')).toHaveText('2 selected');
  await expect(restoredPotato.locator('.card-label').filter({ hasText: 'Work' })).toHaveCount(1);
  await expect(kyoto.locator('.card-label').filter({ hasText: 'Work' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Done selecting' }).click();
  await page.getByRole('button', { name: 'Select items' }).click();
  await palette.getByLabel('Select').check();
  await kyoto.getByLabel('Select').check();
  await page.locator('#bulk-later').click();
  await expect(page.locator('#selected-count')).toHaveText('2 selected');
  await page.getByRole('tab', { name: 'Read later' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(3);
  await expect(page.locator('#selected-count')).toHaveText('2 selected');
  await expect(page.locator('.select-control input:checked')).toHaveCount(2);
  await page.getByRole('button', { name: 'Done selecting' }).click();
  const archivedPotato = page.locator('.bookmark-card').filter({ hasText: 'My archived roast potatoes' });
  await archivedPotato.getByLabel('Read later').uncheck();
  await expect(page.locator('.bookmark-card')).toHaveCount(2);

  await page.getByRole('button', { name: 'Select items' }).click();
  await page.locator('.bookmark-card').nth(0).getByLabel('Select').check();
  await page.locator('.bookmark-card').nth(1).getByLabel('Select').check();
  await page.locator('#bulk-delete').click();
  await expect(page.locator('#bulk-delete-copy')).toContainText('2 bookmarks');
  await expect(page.locator('#bulk-delete-confirm')).toContainText('cannot be undone');
  await page.locator('#confirm-bulk-delete').click();
  await expect(page.getByRole('heading', { name: 'Nothing to read later' })).toBeVisible();
  await page.getByRole('button', { name: 'View all bookmarks' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Delete bookmark' }).click();
  await expect(page.locator('#delete-confirm')).toContainText('cannot be undone');
  await page.locator('#confirm-delete').click();
  await expect(page.getByRole('heading', { name: 'No bookmarks yet' })).toBeVisible();
  await expect(page.locator('#library-controls')).toBeHidden();
});

test('a failed save retains the complete draft and succeeds on retry', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const startingCount = await page.locator('.bookmark-card').count();
  let failed = false;
  await page.route('**/api/bookmarks', async route => {
    if (route.request().method() === 'POST' && !failed) {
      failed = true;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'The save did not reach the server.' }) });
      return;
    }
    await route.fallback();
  });

  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Web address').fill('https://example.com/retry-save');
  await expect(page.locator('#bookmark-fields')).toBeVisible();
  await page.getByLabel('Title').fill('A draft worth keeping');
  await page.getByLabel('Description').fill('My own carefully written description.');
  await page.locator('#new-label').fill('Keep me');
  await page.getByRole('button', { name: 'Create & add' }).click();
  await page.getByRole('button', { name: 'Save bookmark' }).click();

  await expect(page.locator('#operation-error')).toBeVisible();
  await expect(page.locator('#bookmark-dialog')).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('A draft worth keeping');
  await expect(page.getByLabel('Description')).toHaveValue('My own carefully written description.');
  await expect(page.locator('#label-options')).toContainText('Keep me');
  await expect(page.locator('.bookmark-card')).toHaveCount(startingCount);

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('#bookmark-dialog')).toBeHidden();
  await expect(page.locator('.bookmark-card')).toHaveCount(startingCount + 1);
  await expect(page.locator('.bookmark-card').filter({ hasText: 'A draft worth keeping' })).toBeVisible();
});

test('invalid addresses are explained and unavailable page details remain editable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const startingCount = await page.locator('.bookmark-card').count();

  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Web address').fill('example.com/incomplete');
  await expect(page.locator('#url-error')).toContainText('http:// or https://');
  await expect(page.locator('#bookmark-fields')).toBeHidden();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(startingCount);

  await page.route('**/api/bookmarks/prepare', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      if (['https://unavailable.example/page', 'https://gone.example/page'].includes(body.url)) {
        const site = new URL(body.url).hostname;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'new',
            normalizedUrl: body.url,
            draft: {
              url: body.url,
              title: site,
              description: '',
              siteName: site,
              faviconUrl: null,
              fallback: true
            }
          })
        });
        return;
      }
    }
    await route.fallback();
  });

  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Web address').fill('https://unavailable.example/page');
  await expect(page.locator('#fallback-notice')).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('unavailable.example');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.locator('.bookmark-card').filter({ hasText: 'unavailable.example' })).toBeVisible();

  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Web address').fill('https://gone.example/page');
  await expect(page.locator('#fallback-notice')).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('gone.example');
  await page.getByLabel('Title').fill('A page I still want');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.locator('.bookmark-card').filter({ hasText: 'A page I still want' })).toBeVisible();
});

test('long saved details stay complete behind a compact responsive card', async ({ page, request }) => {
  const title = 'The Definitive, Exhaustive, Extremely Detailed Guide to Making the Crispiest Roast Potatoes for Every Occasion';
  const description = 'A very long description that explains every possible technique, ingredient, variation, serving suggestion, troubleshooting tip, and historical detail anyone might want to remember about this page later.';
  const labels = ['Recipes', 'Weekend plans', 'Favorites', 'Cooking', 'Vegetarian', 'Dinner', 'Techniques', 'To try'];
  const response = await request.post('/api/bookmarks', {
    data: {
      url: 'https://example.com/a/very/long/address/for/a/complete/cooking/guide?edition=full',
      siteName: 'Example Kitchen',
      title,
      description,
      faviconUrl: null,
      labels,
      readLater: false
    }
  });
  expect(response.ok()).toBeTruthy();
  const neighbourResponse = await request.post('/api/bookmarks', {
    data: {
      url: 'https://example.com/short-neighbour',
      siteName: 'Example Kitchen',
      title: 'A short neighbouring card',
      description: 'Short and easy to scan.',
      faviconUrl: null,
      labels: ['Cooking'],
      readLater: false
    }
  });
  expect(neighbourResponse.ok()).toBeTruthy();

  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const card = page.locator('.bookmark-card').filter({ hasText: 'The Definitive, Exhaustive' });
  await expect(card).toBeVisible();
  await expect(card.locator('.card-label')).toHaveCount(4);
  await expect(card.locator('.card-label').last()).toHaveText('+5');
  await expect(card.locator('.card-title')).toHaveCSS('-webkit-line-clamp', '2');
  await expect(card.locator('.card-description')).toHaveCSS('-webkit-line-clamp', '3');
  await expect(card.locator('.card-url')).toHaveCSS('text-overflow', 'ellipsis');
  const cardHeights = await page.locator('.bookmark-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height));
  expect(new Set(cardHeights.map(Math.round)).size).toBe(1);
  await expect(card.locator('.card-title a')).toHaveAttribute('href', 'https://example.com/a/very/long/address/for/a/complete/cooking/guide?edition=full');

  await card.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByLabel('Title')).toHaveValue(title);
  await expect(page.getByLabel('Description')).toHaveValue(description);
  await page.locator('#new-label').fill('recipes');
  await page.getByRole('button', { name: 'Create & add' }).click();
  await expect(page.locator('#label-notice')).toContainText('Used your existing “Recipes” label');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await card.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#label-options .label-option').filter({ hasText: /^Recipes$/i })).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).toBeVisible();
  const columns = await page.locator('#bookmark-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
});

test('selection mode deletes exactly two of six and returns to ordinary browsing', async ({ page, request }) => {
  for (let index = 1; index <= 6; index += 1) {
    const response = await request.post('/api/bookmarks', {
      data: {
        url: `https://example.com/bulk-${index}`,
        siteName: 'Example',
        title: `Bulk bookmark ${index}`,
        description: `Sample ${index}`,
        faviconUrl: null,
        labels: [],
        readLater: false
      }
    });
    expect(response.ok()).toBeTruthy();
  }

  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('6 saved');
  await page.getByRole('button', { name: 'Select items' }).click();
  await page.locator('.bookmark-card').nth(0).getByLabel('Select').check();
  await page.locator('.bookmark-card').nth(1).getByLabel('Select').check();
  await expect(page.locator('#selected-count')).toHaveText('2 selected');
  await page.locator('#bulk-delete').click();
  await expect(page.locator('#bulk-delete-copy')).toContainText('2 bookmarks');
  await expect(page.locator('#bulk-delete-confirm')).toContainText('permanent');
  await page.locator('#confirm-bulk-delete').click();
  await expect(page.locator('#result-count')).toHaveText('4 saved');
  await expect(page.locator('.bookmark-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Done selecting' }).click();
  await expect(page.locator('.select-control')).toHaveCount(0);
});
