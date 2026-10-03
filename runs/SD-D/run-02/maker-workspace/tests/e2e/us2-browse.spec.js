import { test, expect } from '@playwright/test';
import { seedBookmark } from './helpers.js';

test('normal list shows title, description, tags and favicon; links open in a new tab', async ({ page, request }) => {
  await seedBookmark(request, {
    url: 'https://browse-one.example/a',
    title: 'Browse One',
    description: 'First description',
    tags: ['alpha'],
  });
  await seedBookmark(request, {
    url: 'https://browse-two.example/b',
    title: 'Browse Two',
    description: 'Second description',
    tags: ['beta'],
  });

  await page.goto('/');
  await expect(page.locator('.app')).toHaveAttribute('data-harness-ready', 'true');

  const card = page.locator('.card', { hasText: 'Browse One' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('First description');
  await expect(card.locator('.tag-pill', { hasText: 'alpha' })).toBeVisible();
  await expect(card.locator('img.favicon')).toBeVisible();

  // Title link opens the original in a new tab.
  const link = card.locator('a.card-title');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', 'https://browse-one.example/a');
});
