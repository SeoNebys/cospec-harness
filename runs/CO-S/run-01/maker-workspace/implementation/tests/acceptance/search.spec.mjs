import { test, expect } from '@playwright/test';

const SEED = [
  { url: 'https://developer.mozilla.org/map', title: 'Array map | MDN', desc: 'new array', note: 'cheatsheet', tags: ['reference', 'javascript'] },
  { url: 'https://css-tricks.com/flexbox', title: 'Guide to Flexbox', desc: 'css layout', note: '', tags: ['reference', 'css'] },
  { url: 'https://nytimes.com/x', title: 'Reading Habit', desc: 'routines', note: 'read on the weekend', tags: ['articles', 'habits'] },
  { url: 'https://github.com/playwright', title: 'playwright', desc: 'end to end testing', note: '', tags: ['tools', 'testing'] },
  { url: 'https://seriouseats.com/cookies', title: 'Chocolate Chip Cookies', desc: 'chewy recipe', note: 'try this weekend', tags: ['cooking', 'recipes'] },
  { url: 'https://smashingmagazine.com/ds', title: 'Design Systems', desc: 'scalable', note: '', tags: ['design', 'reference'] }
];

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/_test/reset');
  for (const b of SEED) await page.request.post('/api/bookmarks', { data: b });
  await page.goto('/');
  await page.waitForSelector('[data-harness-ready="true"]');
  await expect(page.locator('#count')).toHaveText('6 bookmarks');
});

async function search(page, q) {
  await page.fill('#search', q);
}

// SCN-003
test('SCN-003: single word matches across fields incl. note', async ({ page }) => {
  await search(page, 'weekend');
  await expect(page.locator('.bm')).toHaveCount(2);
  await expect(page.locator('#count')).toHaveText('showing 2 of 6');
});

test('SCN-003: case-insensitive and multi-word AND', async ({ page }) => {
  await search(page, 'REFERENCE');
  await expect(page.locator('.bm')).toHaveCount(3);
  await search(page, 'reference css');
  await expect(page.locator('.bm')).toHaveCount(1);
});

test('SCN-003: no matches shows a message', async ({ page }) => {
  await search(page, 'zzznope');
  await expect(page.locator('.empty')).toContainText('No bookmarks match');
});

// SCN-004
test('SCN-004: #tag exact, phrase, OR, NOT, parentheses', async ({ page }) => {
  await search(page, '#reference');
  await expect(page.locator('.bm')).toHaveCount(3);

  await search(page, '#ref'); // substring of tag must not match
  await expect(page.locator('.empty')).toContainText('No bookmarks match');

  await search(page, '"chocolate chip"');
  await expect(page.locator('.bm')).toHaveCount(1);

  await search(page, 'cooking OR testing');
  await expect(page.locator('.bm')).toHaveCount(2);

  await search(page, '#reference NOT css');
  await expect(page.locator('.bm')).toHaveCount(2);

  await search(page, '(cooking OR testing) AND #tools');
  await expect(page.locator('.bm')).toHaveCount(1);
  await expect(page.locator('.bm .title')).toContainText('playwright');
});

test('SCN-004: forgiving of unfinished input', async ({ page }) => {
  await search(page, '(cooking OR');
  await expect(page.locator('.bm')).toHaveCount(1);
});
