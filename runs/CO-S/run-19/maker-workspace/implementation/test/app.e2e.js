import { expect, test } from '@playwright/test';

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function seedBookmarks() {
  return [
    {
      url: 'https://unavailable.invalid/octopus', canonical_url: 'https://unavailable.invalid/octopus',
      title: 'The surprising intelligence of octopuses', description: 'How octopuses solve underwater puzzles.',
      source_host: 'naturalreview.example', site_name: 'Natural Review', author: 'Mira Wells', published_at: '2025-03-02',
      preview_image: pixel, content_html: '<article><h2>A mind unlike ours</h2><p>The complete original observations remain readable in this saved copy.</p></article>',
      tags: ['science'], captured_at: '2025-03-03T10:00:00.000Z', created_at: '2025-03-03T10:00:00.000Z',
    },
    {
      url: 'https://example.com/crows', canonical_url: 'https://example.com/crows', title: 'Crows and clever puzzles',
      description: 'Tool use across the animal world.', source_host: 'example.com', site_name: 'Field Notes', tags: ['animals'],
      created_at: '2025-02-01T10:00:00.000Z',
    },
    {
      url: 'https://example.com/whales', canonical_url: 'https://example.com/whales', title: 'Songs of the whales',
      description: 'Communication in the ocean.', source_host: 'example.com', site_name: 'Field Notes', tags: ['animals'],
      created_at: '2025-01-01T10:00:00.000Z',
    },
    ...Array.from({ length: 7 }, (_, index) => ({
      url: `https://example.com/page-${index}`, canonical_url: `https://example.com/page-${index}`,
      title: index === 0 ? 'A deliberately long reference title whose complete wording remains safely stored beyond the compact card' : `Reference page ${index + 1}`,
      description: index === 0 ? 'A deliberately long description that stays scannable in the library while every original word remains available on the focused reading page.' : `Useful reference number ${index + 1}`,
      source_host: 'example.com', site_name: 'Example', tags: index === 0 ? ['one', 'two', 'three', 'four', 'five'] : [],
      content_html: index === 0 ? '<p>The complete long-form wording remains available here without being discarded.</p>' : '<p>Full reference text.</p>',
      created_at: `2024-12-${String(20 - index).padStart(2, '0')}T10:00:00.000Z`,
    })),
  ];
}

test.beforeEach(async ({ request, page }) => {
  await request.post('/api/__test/reset');
  const response = await request.post('/api/__test/seed', { data: { bookmarks: seedBookmarks() } });
  expect(response.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
});

test('search, correction, tag reuse, sorting, saved views, and pagination work together', async ({ page }) => {
  await expect(page.locator('.bookmark-card')).toHaveCount(8);
  await expect(page.getByText('Showing 1–8')).toBeVisible();
  await expect(page.getByRole('button', { name: '2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.bookmark-card')).toHaveCount(2);
  await page.locator('[data-section="all"]').click();

  await page.getByPlaceholder('Search titles, descriptions, or websites').fill('octopus');
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
  const octopusCard = page.locator('.bookmark-card').filter({ hasText: 'The surprising intelligence of octopuses' });
  await expect(octopusCard).toBeVisible();

  await octopusCard.getByRole('button', { name: 'Edit details' }).click();
  await expect(page.getByRole('heading', { name: 'Edit details' })).toBeVisible();
  await page.locator('#details-title').fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#details-title-error')).toBeVisible();
  await expect(page.locator('#details-dialog')).toHaveAttribute('open', '');
  await page.locator('#details-title').fill('Octopus intelligence');
  await page.locator('#details-description').fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Details updated')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Octopus intelligence' })).toBeVisible();

  const editedCard = page.locator('.bookmark-card').filter({ hasText: 'Octopus intelligence' });
  await editedCard.getByRole('button', { name: 'Tags' }).click();
  await page.locator('#tag-entry').fill('ani');
  const suggestion = page.locator('[data-suggest-tag="animals"]');
  await expect(suggestion).toContainText('used on 2 bookmarks');
  await suggestion.click();
  await page.getByRole('button', { name: 'Save tags' }).click();
  await expect(editedCard.getByText('animals', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByPlaceholder('Search titles, descriptions, or websites').fill('puzzles');
  await page.locator('#tag-filters').getByRole('button', { name: /animals/ }).click();
  await page.locator('#sort-select').selectOption('oldest');
  await page.getByRole('button', { name: /Save this view/ }).click();
  await page.locator('#saved-view-name').fill('');
  await page.getByRole('button', { name: 'Save view' }).click();
  await expect(page.getByText('Give this saved view a name.')).toBeVisible();
  await expect(page.locator('#save-view-dialog')).toHaveAttribute('open', '');
  await page.locator('#saved-view-name').fill('Animal minds');
  await page.getByRole('button', { name: 'Save view' }).click();
  await expect(page.locator('#saved-views-list').getByRole('button', { name: /Animal minds/ })).toBeVisible();

  await page.locator('[data-section="all"]').click();
  await page.locator('#saved-views-list').getByRole('button', { name: /Animal minds/ }).click();
  await expect(page.getByRole('heading', { name: 'Animal minds' })).toBeVisible();
  await expect(page.getByPlaceholder('Search titles, descriptions, or websites')).toHaveValue('puzzles');
  await expect(page.locator('#sort-select')).toHaveValue('oldest');
  await expect(page.locator('[data-tag="animals"]')).toHaveClass(/is-active/);
});

test('Read later, archive, restore, and deliberate deletion remain distinct', async ({ page }) => {
  const title = 'The surprising intelligence of octopuses';
  let card = page.locator('.bookmark-card').filter({ hasText: title });
  await card.getByRole('button', { name: /Read later/ }).click();
  await expect(page.locator('#count-later')).toHaveText('1');
  await page.getByRole('button', { name: /Read later/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Read later' })).toBeVisible();
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await expect(page.getByText('You’re all caught up')).toBeVisible();
  await page.locator('[data-section="all"]').click();
  await expect(page.getByRole('button', { name: title })).toBeVisible();

  card = page.locator('.bookmark-card').filter({ hasText: title });
  await card.getByRole('button', { name: 'Read later' }).click();
  await card.getByRole('button', { name: 'More actions' }).click();
  await card.getByRole('button', { name: /Archive/ }).click();
  await expect(page.locator('#count-later')).toHaveText('0');
  await expect(page.getByRole('button', { name: title })).toHaveCount(0);
  await page.getByRole('button', { name: /Archive/ }).first().click();
  card = page.locator('.bookmark-card').filter({ hasText: title });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Restore/ }).click();
  await expect(page.locator('#count-archive')).toHaveText('0');
  await expect(page.locator('#count-later')).toHaveText('0');

  await page.locator('[data-section="all"]').click();
  card = page.locator('.bookmark-card').filter({ hasText: title });
  await card.getByRole('button', { name: 'More actions' }).click();
  await card.getByRole('button', { name: /Delete permanently/ }).click();
  await expect(page.getByRole('heading', { name: 'Delete this bookmark permanently?' })).toBeVisible();
  await expect(page.locator('#delete-dialog')).toContainText(title);
  await expect(page.locator('#delete-dialog')).toContainText('cannot be undone');
  await page.getByRole('button', { name: 'Keep bookmark' }).click();
  await expect(page.getByRole('button', { name: title })).toBeVisible();

  card = page.locator('.bookmark-card').filter({ hasText: title });
  await card.getByRole('button', { name: 'More actions' }).click();
  await card.getByRole('button', { name: /Delete permanently/ }).click();
  await page.locator('#delete-dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('button', { name: title })).toHaveCount(0);
  await expect(page.locator('#count-archive')).toHaveText('0');
});

test('the dedicated reader shows the frozen saved copy and the original link separately', async ({ page }) => {
  const title = 'The surprising intelligence of octopuses';
  await page.getByRole('button', { name: title }).click();
  await expect(page.locator('#library-screen')).toBeHidden();
  await expect(page.locator('#reader-screen')).toBeVisible();
  await expect(page.locator('#reader-title')).toHaveText(title);
  await expect(page.locator('#reader-description')).toContainText('underwater puzzles');
  await expect(page.locator('#reader-author')).toContainText('Mira Wells');
  await expect(page.locator('#reader-published')).toContainText('2025-03-02');
  await expect(page.locator('#reader-image')).toBeVisible();
  await expect(page.locator('#reader-content')).toContainText('complete original observations');
  await expect(page.locator('#reader-notice')).toContainText('original page is unavailable', { timeout: 10_000 });
  await expect(page.getByRole('link', { name: /Try original page/ })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('link', { name: /Try original page/ })).toHaveAttribute('href', 'https://unavailable.invalid/octopus');
  await page.getByRole('button', { name: 'Back to bookmarks' }).click();
  await expect(page.locator('#library-screen')).toBeVisible();
});

test('long cards stay compact without discarding their complete saved content', async ({ page }) => {
  const longTitle = 'A deliberately long reference title whose complete wording remains safely stored beyond the compact card';
  const card = page.locator('.bookmark-card').filter({ hasText: longTitle });
  await expect(card).toBeVisible();
  await expect(card.locator('.tag-pill.more')).toHaveText('+3');
  await expect(card.locator('.bookmark-title')).toHaveCSS('-webkit-line-clamp', '2');
  await expect(card.locator('.bookmark-description')).toHaveCSS('-webkit-line-clamp', '2');
  await card.getByRole('button', { name: longTitle }).click();
  await expect(page.locator('#reader-title')).toHaveText(longTitle);
  await expect(page.locator('#reader-content')).toContainText('complete long-form wording remains available');
});

test('invalid and unreadable addresses recover safely, and changes persist across a reload', async ({ page }) => {
  const saveInput = page.getByPlaceholder('https://example.com/an-article');
  await saveInput.fill('this is not a link');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(saveInput).toHaveValue('this is not a link');
  await expect(page.locator('#save-error')).toContainText('complete web address');
  await expect(page.locator('#save-error')).toContainText('https://example.com/article');
  await expect(page.locator('#count-all')).toHaveText('10');

  await page.route('/api/bookmarks', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'capture_failed', message: 'We could not read this page.', url: 'https://locked.example/article' } }),
      });
    } else await route.continue();
  });
  await saveInput.fill('https://locked.example/article');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('Nothing has been saved yet.')).toBeVisible();
  await expect(page.getByText(/requires sign-in or blocks saved copies/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter details myself' }).click();
  await page.locator('#manual-title').fill('Locked research notes');
  await page.locator('#manual-description').fill('Saved by hand');
  await page.getByRole('button', { name: 'Save without a copy' }).click();
  await expect(page.getByRole('button', { name: 'Locked research notes' })).toBeVisible();
  const manualCard = page.locator('.bookmark-card').filter({ hasText: 'Locked research notes' });
  await expect(manualCard).toContainText('No saved page copy');

  await manualCard.getByRole('button', { name: /Read later/ }).click();
  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.locator('#count-all')).toHaveText('11');
  await expect(page.locator('#count-later')).toHaveText('1');
});
