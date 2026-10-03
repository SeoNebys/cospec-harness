import { test, expect } from "@playwright/test";
import { routeMetadata, saveLink } from "./helpers.mjs";

// SCN-006: read-later is an additional marker.
test("read later marks a bookmark but keeps it in All", async ({ page }) => {
  await routeMetadata(page, { "a.com": { error: false, title: "A", description: "", image: "", favicon: "", host: "a.com" } });
  await page.goto("/");
  await saveLink(page, "https://a.com");

  await page.click('[data-action="readlater"]');
  await expect(page.locator(".badge.readlater")).toBeVisible();
  await expect(page.locator('[data-view="readlater"] .count')).toHaveText("1");
  // still present in All
  await expect(page.locator(".card")).toHaveCount(1);

  // appears in Read Later view
  await page.click('[data-view="readlater"]');
  await expect(page.locator(".card .title")).toHaveText("A");

  // removing the marker takes it out of Read Later but not deleted
  await page.click('[data-action="readlater"]');
  await expect(page.locator(".card")).toHaveCount(0);
  await page.click('[data-view="all"]');
  await expect(page.locator(".card")).toHaveCount(1);
});

// SCN-007: archive is a move; restore returns it.
test("archive removes from All and searches; restore returns it", async ({ page }) => {
  await routeMetadata(page, {
    "a.com": { error: false, title: "Alpha", description: "", image: "", favicon: "", host: "a.com" },
    "b.com": { error: false, title: "Beta", description: "", image: "", favicon: "", host: "b.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://a.com");
  await saveLink(page, "https://b.com");

  // archive the top card (Beta)
  await page.locator(".card").first().locator('[data-action="archive"]').click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator('[data-view="archive"] .count')).toHaveText("1");

  // excluded from ordinary search
  await page.fill("#searchInput", "Beta");
  await expect(page.locator(".card")).toHaveCount(0);
  await page.fill("#searchInput", "");

  // present in Archive with only Restore
  await page.click('[data-view="archive"]');
  await expect(page.locator(".card .title")).toHaveText("Beta");
  await expect(page.locator('[data-action="restore"]')).toBeVisible();
  await expect(page.locator('[data-action="edit"]')).toHaveCount(0);

  // restore returns it to All
  await page.click('[data-action="restore"]');
  await page.click('[data-view="all"]');
  await expect(page.locator(".card")).toHaveCount(2);
});

test("empty read-later and archive views explain themselves", async ({ page }) => {
  await routeMetadata(page);
  await page.goto("/");
  await saveLink(page, "https://a.com");
  await page.click('[data-view="readlater"]');
  await expect(page.locator("#empty")).toContainText("read-later");
  await page.click('[data-view="archive"]');
  await expect(page.locator("#empty")).toContainText("archive");
});
