import { test, expect } from '@playwright/test';
import { seedBookmark } from './helpers.js';

test('markdown note renders when viewed', async ({ page, request }) => {
  const b = await seedBookmark(request, { url: 'https://org-note.example/x', title: 'Note Card' });
  await page.goto('/');
  const card = page.locator('.card', { hasText: 'Note Card' });
  await card.getByRole('button', { name: 'Edit' }).click();
  await page.getByTestId('field-note').fill('**bold note** and _italic_');
  await page.getByTestId('dialog-submit').click();
  const rendered = page.locator('.card', { hasText: 'Note Card' }).locator('.card-note');
  await expect(rendered.locator('strong', { hasText: 'bold note' })).toBeVisible();
});

test('reused tag name is one shared identity; click-to-filter narrows', async ({ page, request }) => {
  await seedBookmark(request, { url: 'https://org-t1.example', title: 'Tagged A', tags: ['Shared'] });
  await seedBookmark(request, { url: 'https://org-t2.example', title: 'Tagged B', tags: ['shared'] });
  await page.goto('/');
  // One shared tag identity ("shared") with count 2 in the sidebar.
  const sideTag = page.locator('.side-tag', { hasText: 'shared' });
  await expect(sideTag).toHaveCount(1);
  await expect(sideTag).toContainText('2');

  // Click a tag pill on a card to filter.
  await page.locator('.card', { hasText: 'Tagged A' }).locator('.tag-pill', { hasText: 'shared' }).click();
  await expect(page.locator('.context-label')).toContainText(/#shared/i);
  await expect(page.locator('.card', { hasText: 'Tagged A' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Tagged B' })).toBeVisible();
});

test('archive hides from normal and shows in archived; delete is permanent', async ({ page, request }) => {
  await seedBookmark(request, { url: 'https://org-arch.example', title: 'ArchiveMe' });
  await seedBookmark(request, { url: 'https://org-del.example', title: 'DeleteMe' });
  await page.goto('/');

  // Archive.
  await page.locator('.card', { hasText: 'ArchiveMe' }).getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.locator('.card', { hasText: 'ArchiveMe' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await expect(page.locator('.card', { hasText: 'ArchiveMe' })).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click();

  // Permanent delete (auto-accept confirm).
  page.on('dialog', (d) => d.accept());
  await page.locator('.card', { hasText: 'DeleteMe' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.card', { hasText: 'DeleteMe' })).toHaveCount(0);
});

test('unread view reflects read-state toggles', async ({ page, request }) => {
  await seedBookmark(request, { url: 'https://org-read.example', title: 'ReadState' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Unread', exact: true }).click();
  await expect(page.locator('.card', { hasText: 'ReadState' })).toBeVisible();
  await page.locator('.card', { hasText: 'ReadState' }).getByRole('button', { name: 'Mark read' }).click();
  await expect(page.locator('.card', { hasText: 'ReadState' })).toHaveCount(0);
});
