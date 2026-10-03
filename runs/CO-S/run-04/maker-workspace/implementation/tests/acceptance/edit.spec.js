import { test, expect } from "@playwright/test";
import { routeMetadata, saveLink } from "./helpers.mjs";

// SCN-002: correct title/description, edit URL, optional re-fetch.
test("editing title and description keeps them, marks edited", async ({ page }) => {
  await routeMetadata(page, {
    "example.com/a": { error: false, title: "Original Title", description: "Original desc", image: "", favicon: "", host: "example.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://example.com/a");

  await page.click('[data-action="edit"]');
  await page.fill(".edit-title", "My Title");
  await page.fill(".edit-desc", "My description");
  await page.click('[data-action="save-edit"]');

  await expect(page.locator(".card .title")).toHaveText("My Title");
  await expect(page.locator(".card .desc")).toHaveText("My description");
  await expect(page.locator(".edited-flag")).toBeVisible();
});

test("changing URL keeps curated text by default", async ({ page }) => {
  await routeMetadata(page, {
    "example.com/a": { error: false, title: "Curated", description: "Curated desc", image: "", favicon: "", host: "example.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://example.com/a");

  await page.click('[data-action="edit"]');
  await page.fill(".edit-url", "https://elsewhere.org/b");
  await page.click('[data-action="save-edit"]');

  await expect(page.locator(".card .title")).toHaveText("Curated");
  await expect(page.locator(".card .host")).toContainText("elsewhere.org");
  await expect(page.locator(".card .title a")).toHaveAttribute("href", "https://elsewhere.org/b");
});

test("re-fetch option replaces details from the new link", async ({ page }) => {
  await routeMetadata(page, {
    "example.com/a": { error: false, title: "Curated", description: "Curated desc", image: "", favicon: "", host: "example.com" },
    "fresh.org/new": { error: false, title: "Fresh Title", description: "Fresh desc", image: "", favicon: "", host: "fresh.org" },
  });
  await page.goto("/");
  await saveLink(page, "https://example.com/a");

  await page.click('[data-action="edit"]');
  await page.fill(".edit-url", "https://fresh.org/new");
  await page.check(".edit-refetch");
  await page.click('[data-action="save-edit"]');
  await page.waitForFunction(() => document.querySelectorAll(".card.pending").length === 0);

  await expect(page.locator(".card .title")).toHaveText("Fresh Title");
  await expect(page.locator(".card .desc")).toHaveText("Fresh desc");
});
