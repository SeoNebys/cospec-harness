import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('approved bookmark-management journey works in the browser', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  await page.getByLabel('Email').fill('owner@example.com');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Those details do not match this account.')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue('owner@example.com');
  await expect(page.getByLabel('Password')).toHaveValue('');

  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Save a new link')).toBeVisible();

  await page.getByLabel('Save a new link').fill('not a link');
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByText(/full web address/i)).toBeVisible();
  await expect(page.getByLabel('Save a new link')).toHaveValue('not a link');

  await page.getByLabel('Save a new link').fill('https://recipes.example/roman-pasta');
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByRole('link', { name: 'Essential Roman Pasta Recipes', exact: true })).toBeVisible();
  await expect(page.getByText('The Kitchen Journal')).toBeVisible();

  await page.getByRole('button', { name: '+ Add tag' }).click();
  await page.getByLabel('Tag name').fill('Cooking');
  await page.getByLabel('Tag name').press('Enter');
  await expect(page.locator('.tag-chip', { hasText: 'Cooking' })).toBeVisible();

  await page.getByLabel('Read later').check();
  await expect(page.getByRole('tab', { name: /Read later \(1\)/ })).toBeVisible();
  await page.getByRole('tab', { name: /Read later/ }).click();
  await expect(page.getByRole('button', { name: 'Mark as read' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await expect(page.getByText('Nothing waiting for you')).toBeVisible();

  await page.getByRole('tab', { name: /All bookmarks/ }).click();
  await page.getByRole('button', { name: 'Bookmark actions' }).click();
  await page.getByRole('button', { name: 'Add note…' }).click();
  const editor = page.getByRole('textbox', { name: 'Note' });
  await editor.fill('Make this for Sunday dinner');
  await editor.selectText();
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.locator('.note-block').locator('b, strong')).toHaveText('Make this for Sunday dinner');

  await page.getByLabel('Search bookmarks').fill('sunday');
  await expect(page.getByRole('link', { name: 'Essential Roman Pasta Recipes', exact: true })).toBeVisible();
  await page.getByLabel('Search bookmarks').fill('nothing-here');
  await expect(page.getByText('No bookmarks match')).toBeVisible();
  await expect(page.getByLabel('Search bookmarks')).toHaveValue('nothing-here');
  await page.getByLabel('Clear search').click();

  await page.getByRole('button', { name: 'Bookmark actions' }).click();
  await page.getByRole('button', { name: 'Set aside' }).click();
  await expect(page.getByText('Your collection is ready')).toBeVisible();
  await page.getByRole('tab', { name: /Set aside \(1\)/ }).click();
  await expect(page.getByRole('link', { name: 'Essential Roman Pasta Recipes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('tab', { name: /All bookmarks/ }).click();
  await expect(page.locator('.note-block').locator('b, strong')).toHaveText('Make this for Sunday dinner');
  await expect(page.locator('.tag-chip', { hasText: 'Cooking' })).toBeVisible();
});

test('duplicate, suggestions, combined search, long notes, fallback, deletion, and batching honor the approved edges', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByLabel('Email').fill('owner@example.com');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByLabel('Save a new link').fill('https://recipes.example/roman-pasta?utm_source=newsletter');
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByText('You already saved this link — here it is.')).toBeVisible();
  await expect(page.locator('.bookmark-card.flash')).toContainText('Essential Roman Pasta Recipes');

  await page.getByLabel('Save a new link').fill('https://travel.example/rome-guide');
  await page.getByRole('button', { name: 'Save link' }).click();
  const travelCard = page.locator('.bookmark-card').filter({ hasText: 'A Quiet Guide to Rome' });
  await travelCard.getByRole('button', { name: '+ Add tag' }).click();
  await travelCard.getByLabel('Tag name').fill('Italian');
  await travelCard.getByLabel('Tag name').press('Enter');
  await travelCard.getByRole('button', { name: '+ Add tag' }).click();
  await travelCard.getByLabel('Tag name').fill('Travel');
  await travelCard.getByLabel('Tag name').press('Enter');

  const pastaCard = page.locator('.bookmark-card').filter({ hasText: 'Essential Roman Pasta Recipes' });
  await pastaCard.getByRole('button', { name: '+ Add tag' }).click();
  await pastaCard.getByLabel('Tag name').fill('ita');
  await expect(pastaCard.locator('.suggestions').getByRole('button', { name: 'Italian' })).toBeVisible();
  await pastaCard.locator('.suggestions').getByRole('button', { name: 'Italian' }).click();
  await expect(pastaCard.locator('.tag-chip', { hasText: 'Cooking' })).toBeVisible();
  await expect(pastaCard.locator('.tag-chip', { hasText: 'Italian' })).toBeVisible();

  await page.getByLabel('Search bookmarks').fill('rome');
  await expect(page.locator('.bookmark-card')).toHaveCount(2);
  await page.getByRole('button', { name: /Travel 1/ }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'A Quiet Guide to Rome', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Travel 1/ }).click();
  await page.getByLabel('Clear search').click();

  const pastaAgain = page.locator('.bookmark-card').filter({ hasText: 'Essential Roman Pasta Recipes' });
  await pastaAgain.getByLabel('Remove Italian tag').click();
  await expect(pastaAgain.locator('.tag-chip', { hasText: 'Italian' })).toHaveCount(0);
  await expect(pastaAgain.locator('.tag-chip', { hasText: 'Cooking' })).toBeVisible();
  await expect(travelCard.locator('.tag-chip', { hasText: 'Italian' })).toBeVisible();

  await pastaAgain.getByRole('button', { name: 'Bookmark actions' }).click();
  await pastaAgain.getByRole('button', { name: 'Edit note…' }).click();
  const editor = page.getByRole('textbox', { name: 'Note' });
  await editor.evaluate((element) => {
    element.innerHTML = `<ul><li><strong>Make this for Sunday dinner</strong></li><li>Buy tomatoes and a large bunch of fresh parsley from the market</li><li>Invite friends and ask everyone to arrive before the pasta water boils</li><li>Use the large pot and warm every serving bowl</li><li>Grate plenty of pecorino at the very end so the full note has a searchable hidden detail</li></ul>`;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  });
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(pastaAgain.locator('.note-content')).toHaveClass(/collapsed/);
  await pastaAgain.getByRole('button', { name: 'Show full note' }).click();
  await expect(pastaAgain.locator('.note-content')).not.toHaveClass(/collapsed/);
  await pastaAgain.getByRole('button', { name: 'Show less' }).click();
  await page.getByLabel('Search bookmarks').fill('pecorino');
  await expect(page.getByRole('link', { name: 'Essential Roman Pasta Recipes', exact: true })).toBeVisible();
  await page.getByLabel('Clear search').click();

  await page.getByLabel('Save a new link').fill('https://unreadable.invalid/missing-page');
  await page.getByRole('button', { name: 'Save link' }).click();
  const fallbackCard = page.locator('.bookmark-card').filter({ hasText: 'missing page' });
  await expect(fallbackCard.getByText(/Details unavailable/)).toBeVisible();
  await expect(fallbackCard.locator('.description')).toHaveCount(0);
  await expect(fallbackCard.locator('.preview img')).toHaveCount(0);
  await fallbackCard.getByRole('button', { name: 'Bookmark actions' }).click();
  await fallbackCard.getByRole('button', { name: 'Delete bookmark…' }).click();
  await expect(page.getByRole('heading', { name: 'Delete bookmark?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(fallbackCard).toHaveCount(0);

  const batchUrls = ['buried-gem-alpha', ...Array.from({ length: 12 }, (_, index) => `batch-${index + 1}`)];
  for (const slug of batchUrls) {
    const response = await page.request.post('/api/bookmarks', { data: { url: `https://unreadable.invalid/${slug}` } });
    expect(response.ok()).toBeTruthy();
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Load more' })).toBeVisible();
  await page.getByLabel('Search bookmarks').fill('buried-gem-alpha');
  await expect(page.getByRole('link', { name: 'buried gem alpha', exact: true })).toBeVisible();
  await page.getByLabel('Clear search').click();
  const before = await page.locator('.bookmark-card').count();
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect.poll(() => page.locator('.bookmark-card').count()).toBeGreaterThan(before);
});

test('an expired session returns an unfinished draft without committing it', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('owner@example.com');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Search bookmarks').fill('Essential Roman Pasta');
  await expect(page.getByRole('link', { name: 'Essential Roman Pasta Recipes', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Bookmark actions' }).click();
  await page.getByRole('button', { name: 'Edit note…' }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('Unfinished draft — do not save automatically');
  await context.clearCookies();
  await page.getByRole('button', { name: 'Save note' }).click();

  await expect(page.getByText('Your session ended. Sign in again to continue where you left off.')).toBeVisible();
  await page.getByLabel('Email').fill('owner@example.com');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveText('Unfinished draft — do not save automatically');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.note-block')).toContainText('Make this for Sunday dinner');
  await expect(page.locator('.note-block')).not.toContainText('Unfinished draft');
});
