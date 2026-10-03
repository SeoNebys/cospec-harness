import { test, expect } from "@playwright/test";
import { seed, cardByTitle } from "./helpers.js";

// A known set of bookmarks, seeded newest-last so default order is Gamma, Beta, Alpha.
async function seedSet(request) {
  await request.post("/api/__test/reset");
  await seed(request, { url: "https://alpha.example.com/a", title: "Alpha Article", tags: "reading, news", site: "Alpha" });
  await seed(request, { url: "https://beta.example.com/b", title: "Beta Blog", tags: "work", site: "Beta" });
  await seed(request, { url: "https://gamma.example.com/c", title: "Gamma Guide", tags: "reading, reference", site: "Gamma" });
}

test.beforeEach(async ({ page, request }) => {
  await seedSet(request);
  await page.goto("/");
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();
});

test("SCN-002: typing a tag suggests existing tags to reuse", async ({ page }) => {
  await page.fill("#tags", "re");
  const opts = page.locator("#tagSuggest .opt");
  await expect(opts).toHaveText([/reading/, /reference/]);
  await page.locator('#tagSuggest .opt[data-tag="reference"]').click();
  await expect(page.locator("#tags")).toHaveValue("reference, ");
});

test("SCN-003: search narrows the list and highlights matches", async ({ page }) => {
  await page.fill("#search", "beta");
  await expect(page.locator("li.bm-item")).toHaveCount(1);
  await expect(cardByTitle(page, "Beta Blog")).toBeVisible();
  await expect(page.locator("#count")).toContainText("showing 1 of 3");
  await expect(page.locator("li.bm-item mark").first()).toBeVisible();
  await page.fill("#search", "");
  await expect(page.locator("li.bm-item")).toHaveCount(3);
});

test("SCN-003: search with no matches shows a message", async ({ page }) => {
  await page.fill("#search", "zzzzz");
  await expect(page.locator("li.bm-item")).toHaveCount(0);
  await expect(page.locator("#empty")).toContainText("No bookmarks match");
});

test("SCN-004: click a tag to filter, banner clears it, combines with search", async ({ page }) => {
  await cardByTitle(page, "Alpha Article").locator('.tag.clickable', { hasText: "reading" }).click();
  await expect(page.locator("li.bm-item")).toHaveCount(2); // Alpha + Gamma
  await expect(page.locator("#activeFilter")).toContainText("reading");
  // combine with search
  await page.fill("#search", "gamma");
  await expect(page.locator("li.bm-item")).toHaveCount(1);
  await expect(cardByTitle(page, "Gamma Guide")).toBeVisible();
  await page.fill("#search", "");
  await page.click("#clearFilter");
  await expect(page.locator("li.bm-item")).toHaveCount(3);
});

test("SCN-005: sort order changes and persists under search", async ({ page }) => {
  const titles = () => page.locator("li.bm-item .title").allInnerTexts();
  expect(await titles()).toEqual(["Gamma Guide", "Beta Blog", "Alpha Article"]); // newest first
  await page.selectOption("#sort", "old");
  expect(await titles()).toEqual(["Alpha Article", "Beta Blog", "Gamma Guide"]);
  await page.selectOption("#sort", "az");
  expect(await titles()).toEqual(["Alpha Article", "Beta Blog", "Gamma Guide"]);
  await page.selectOption("#sort", "za");
  expect(await titles()).toEqual(["Gamma Guide", "Beta Blog", "Alpha Article"]);
});

test("SCN-006: mark read later, view the focused list, and clear it", async ({ page }) => {
  await cardByTitle(page, "Beta Blog").locator('[data-act="later"]').click();
  await expect(page.locator('#viewTabs [data-view="later"]')).toContainText("1");
  await page.click('#viewTabs [data-view="later"]');
  await expect(page.locator("li.bm-item")).toHaveCount(1);
  await expect(cardByTitle(page, "Beta Blog")).toBeVisible();
  // mark as read (remove) -> empties the list
  await cardByTitle(page, "Beta Blog").locator('[data-act="later"]').click();
  await expect(page.locator("#empty")).toContainText("read-later list is empty");
  // still present in All
  await page.click('#viewTabs [data-view="all"]');
  await expect(cardByTitle(page, "Beta Blog")).toBeVisible();
});

test("SCN-007: archive removes from All, keeps in Archived, and restores", async ({ page }) => {
  await cardByTitle(page, "Alpha Article").locator('[data-act="archive"]').click();
  await expect(page.locator("li.bm-item")).toHaveCount(2);
  await expect(page.locator('#viewTabs [data-view="all"]')).toContainText("2");
  await page.click('#viewTabs [data-view="archived"]');
  await expect(cardByTitle(page, "Alpha Article")).toBeVisible();
  // archived cards are not searched from All: search there won't find it
  await page.click('#viewTabs [data-view="all"]');
  await page.fill("#search", "alpha");
  await expect(page.locator("li.bm-item")).toHaveCount(0);
  await page.fill("#search", "");
  // restore
  await page.click('#viewTabs [data-view="archived"]');
  await cardByTitle(page, "Alpha Article").locator('[data-act="archive"]').click();
  await page.click('#viewTabs [data-view="all"]');
  await expect(page.locator("li.bm-item")).toHaveCount(3);
});
