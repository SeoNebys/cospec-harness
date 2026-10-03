import { performance } from 'node:perf_hooks';

import { expect, test, type Page } from '@playwright/test';
import {
  clearPerformanceDatabase,
  KNOWN_BOOKMARK_QUERY,
  KNOWN_BOOKMARK_TITLE,
  PERFORMANCE_BOOKMARK_COUNT,
  PERFORMANCE_FILTER_COUNT,
  PERFORMANCE_FILTER_TAG,
  seedPerformanceDatabase,
} from '../fixtures/seed.js';

const UPDATE_BUDGET_MS = 1_000;
const RETRIEVAL_BUDGET_MS = 10_000;

async function measureVisibleUpdate(
  page: Page,
  action: () => Promise<void>,
  condition:
    | { kind: 'text'; value: string }
    | { kind: 'first-title'; value: string },
): Promise<number> {
  const startedAt = await page.evaluate(() => window.performance.now());
  await action();
  await page.waitForFunction(({ kind, value }) => {
    if (kind === 'first-title') {
      return document.querySelector('article h3 a')?.textContent?.trim() === value;
    }
    return document.body.textContent?.includes(value) === true;
  }, condition);
  return await page.evaluate(
    (started) => window.performance.now() - started,
    startedAt,
  );
}

test.afterEach(() => {
  clearPerformanceDatabase();
});

test('@performance finds, filters, and sorts a 1,000-bookmark library within budget', async ({
  page,
}) => {
  const seeded = seedPerformanceDatabase();
  expect(seeded.bookmarkCount).toBe(PERFORMANCE_BOOKMARK_COUNT);
  expect(seeded.filterCount).toBe(PERFORMANCE_FILTER_COUNT);

  const retrievalStartedAt = performance.now();
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByText(`${PERFORMANCE_BOOKMARK_COUNT} saved`, { exact: true })).toBeVisible();

  const search = page.getByRole('searchbox', { name: /search bookmarks/i });
  const searchElement = await search.elementHandle();
  expect(searchElement).not.toBeNull();
  const searchDuration = await measureVisibleUpdate(
    page,
    () => searchElement!.fill(KNOWN_BOOKMARK_QUERY),
    { kind: 'text', value: '1 saved' },
  );
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('link', { name: KNOWN_BOOKMARK_TITLE })).toBeVisible();
  expect(searchDuration).toBeLessThan(UPDATE_BUDGET_MS);
  const retrievalDuration = performance.now() - retrievalStartedAt;
  expect(retrievalDuration).toBeLessThan(RETRIEVAL_BUDGET_MS);

  await search.fill('');
  await expect(page.getByText(`${PERFORMANCE_BOOKMARK_COUNT} saved`, { exact: true })).toBeVisible();

  const cohortFilter = page.getByRole('checkbox', {
    name: new RegExp(`${PERFORMANCE_FILTER_TAG} \\(${PERFORMANCE_FILTER_COUNT}\\)`, 'i'),
  });
  const cohortFilterElement = await cohortFilter.elementHandle();
  expect(cohortFilterElement).not.toBeNull();
  const filterDuration = await measureVisibleUpdate(
    page,
    () => cohortFilterElement!.check(),
    { kind: 'text', value: `${PERFORMANCE_FILTER_COUNT} saved` },
  );
  await expect(page.getByRole('article')).toHaveCount(PERFORMANCE_FILTER_COUNT);
  expect(filterDuration).toBeLessThan(UPDATE_BUDGET_MS);

  const sort = page.getByRole('combobox', { name: /sort bookmarks/i });
  const sortElement = await sort.elementHandle();
  expect(sortElement).not.toBeNull();
  const sortDuration = await measureVisibleUpdate(
    page,
    () => sortElement!.selectOption('title'),
    { kind: 'first-title', value: KNOWN_BOOKMARK_TITLE },
  );
  await expect(page.getByRole('article').first()).toContainText(KNOWN_BOOKMARK_TITLE);
  expect(sortDuration).toBeLessThan(UPDATE_BUDGET_MS);

  await test.info().attach('performance-results.json', {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        bookmarkCount: seeded.bookmarkCount,
        retrievalDurationMs: retrievalDuration,
        searchDurationMs: searchDuration,
        filterDurationMs: filterDuration,
        sortDurationMs: sortDuration,
        budgetsMs: {
          retrieval: RETRIEVAL_BUDGET_MS,
          visibleUpdate: UPDATE_BUDGET_MS,
        },
      },
      null,
      2,
    ),
  });
});
