// E2E — User Story 6: bulk actions incl. select-everything-matching. Quickstart 13.

import { test, expect } from "@playwright/test";

async function save(page, url: string) {
  await page.getByTestId("url-input").fill(url);
  await page.getByTestId("save-button").click();
}

test("hand-select several, then tag them all at once", async ({ page }) => {
  await page.goto("/");
  await save(page, "https://bulk-a.example/1");
  await save(page, "https://bulk-b.example/2");

  const checks = page.getByTestId("bookmark-select");
  await checks.nth(0).check();
  await checks.nth(1).check();
  await expect(page.getByTestId("bulk-count")).toContainText("2 selected");

  await page.getByTestId("bulk-tag-input").fill("triaged");
  await page.getByTestId("bulk-add-tag").click();

  const tagged = page.getByTestId("bookmark-tags").filter({ hasText: "triaged" });
  await expect(tagged).toHaveCount(2);
});

test("select everything matching a filter and archive it in one action", async ({ page }) => {
  await page.goto("/");
  await save(page, "https://old-1.example/x");
  await save(page, "https://old-2.example/y");
  // Tag both via bulk first so we can filter to them.
  await page.getByTestId("bookmark-select").nth(0).check();
  await page.getByTestId("bookmark-select").nth(1).check();
  await page.getByTestId("bulk-tag-input").fill("old-work");
  await page.getByTestId("bulk-add-tag").click();

  // Filter to the tag, select everything matching, archive.
  await page.getByTestId("tag-filter-old-work").click(); // include
  await page.getByTestId("bookmark-select").nth(0).check();
  await page.getByTestId("select-all-matching").click();
  await expect(page.getByTestId("bulk-count")).toContainText("matching selected");
  await page.getByTestId("bulk-archive").click();

  // All matching left the main list.
  await expect(page.getByTestId("bookmark-item")).toHaveCount(0);
});
