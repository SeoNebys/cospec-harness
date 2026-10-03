import { test, expect } from "@playwright/test";
import { routeMetadata, saveLink } from "./helpers.mjs";

// SCN-012: the collection persists between visits (browser-local).
test("bookmarks, tags, notes, read-later and archive survive a reload", async ({ page }) => {
  await routeMetadata(page, {
    "keep.com": { error: false, title: "Keeper", description: "desc", image: "", favicon: "", host: "keep.com" },
    "later.com": { error: false, title: "Later", description: "", image: "", favicon: "", host: "later.com" },
    "old.com": { error: false, title: "Old", description: "", image: "", favicon: "", host: "old.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://keep.com");
  // tag + note the keeper
  await page.click('[data-action="organize"]');
  await page.fill(".org-newtag", "important");
  await page.press(".org-newtag", "Enter");
  await page.fill(".org-note", "remember **this**");
  await page.click('[data-action="save-org"]');

  await saveLink(page, "https://later.com");
  await page.locator(".card").first().locator('[data-action="readlater"]').click();

  await saveLink(page, "https://old.com");
  await page.locator(".card").first().locator('[data-action="archive"]').click();

  // Reload — simulate returning later.
  await page.reload();
  await page.waitForSelector('[data-harness-ready="true"]');

  // All view: keeper + later (old is archived)
  await expect(page.locator(".card")).toHaveCount(2);
  await expect(page.locator('.card:has-text("Keeper") .tags .chip')).toHaveText("important");
  await expect(page.locator('.card:has-text("Keeper") .note strong')).toHaveText("this");
  await expect(page.locator('[data-view="readlater"] .count')).toHaveText("1");
  await expect(page.locator('[data-view="archive"] .count')).toHaveText("1");

  await page.click('[data-view="archive"]');
  await expect(page.locator(".card .title")).toHaveText("Old");
});
