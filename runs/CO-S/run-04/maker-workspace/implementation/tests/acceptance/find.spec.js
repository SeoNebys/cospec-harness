import { test, expect } from "@playwright/test";
import { routeMetadata, saveLink } from "./helpers.mjs";

// Build a small tagged library shared by these tests.
async function seed(page) {
  await routeMetadata(page, {
    "css.com": { error: false, title: "CSS Grid Guide", description: "layout", image: "", favicon: "", host: "css.com" },
    "test.com": { error: false, title: "Test Pyramid", description: "unit tests", image: "", favicon: "", host: "test.com" },
    "design.com": { error: false, title: "Usability Heuristics", description: "principles", image: "", favicon: "", host: "design.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://css.com");
  await tag(page, 0, ["css", "reference"]);
  await saveLink(page, "https://test.com");
  await tag(page, 0, ["testing"]);
  await saveLink(page, "https://design.com");
  await tag(page, 0, ["design", "reference"]);
}

async function tag(page, index, tags) {
  const card = page.locator(".card").nth(index);
  await card.locator('[data-action="organize"]').click();
  for (const t of tags) {
    await card.locator(".org-newtag").fill(t);
    await card.locator(".org-newtag").press("Enter");
  }
  await card.locator('[data-action="save-org"]').click();
}

// SCN-005
test("case-insensitive search across fields", async ({ page }) => {
  await seed(page);
  await page.fill("#searchInput", "TEST");
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card .title")).toHaveText("Test Pyramid");
});

test("#tag exact and boolean operators", async ({ page }) => {
  await seed(page);
  await page.fill("#searchInput", "#reference");
  await expect(page.locator(".card")).toHaveCount(2);

  await page.fill("#searchInput", "#reference NOT #design");
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card .title")).toHaveText("CSS Grid Guide");

  await page.fill("#searchInput", "(css OR design) AND #reference");
  await expect(page.locator(".card")).toHaveCount(2);
});

// SCN-004
test("tag filters narrow with AND and combine with search", async ({ page }) => {
  await seed(page);
  await page.locator('.filter-chip[data-filter-tag="reference"]').click();
  await expect(page.locator(".card")).toHaveCount(2);
  await page.locator('.filter-chip[data-filter-tag="design"]').click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card .title")).toHaveText("Usability Heuristics");

  // clear resets
  await page.locator('[data-action="clear-filters"]').click();
  await expect(page.locator(".card")).toHaveCount(3);
});

test("no matches shows a message", async ({ page }) => {
  await seed(page);
  await page.fill("#searchInput", "zzzznomatch");
  await expect(page.locator(".card")).toHaveCount(0);
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator("#empty")).toContainText("No bookmarks match");
});
