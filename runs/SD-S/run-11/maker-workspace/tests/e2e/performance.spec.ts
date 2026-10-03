import { test, expect } from '@playwright/test';
import { largeLibrary } from '../fixtures/large-library.ts';

test('1,000-bookmark search/filter updates meet the one-second goal', async ({ page, request }, info) => {
  test.setTimeout(120_000);
  test.skip(info.project.name !== 'desktop', 'The dataset performance criterion runs once; mobile layout is covered separately.');
  const token = `perf-${Date.now()}`;
  const fixtures = largeLibrary().map((item, i) => ({ ...item, url: `https://${token}-${i}.example.com`, title: `${token} ${item.title}` }));
  for (let i = 0; i < fixtures.length; i += 25) await Promise.all(fixtures.slice(i, i + 25).map(data => request.post('/api/bookmarks', { data })));
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const started = performance.now();
    const response = page.waitForResponse(r => r.url().includes('/api/bookmarks?') && r.status() === 200);
    await page.getByLabel('Search bookmarks').fill(i % 2 ? `${token} Item 0001` : token);
    await response;
    await expect(page.locator('.bookmark-card').first()).toBeVisible();
    samples.push(performance.now() - started);
  }
  expect(samples.filter(ms => ms < 1000).length).toBeGreaterThanOrEqual(19);
});
