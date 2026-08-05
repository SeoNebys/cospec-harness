// E2E — User Story 7: save a search and reopen it. Mirrors quickstart 14.

import { test, expect } from "@playwright/test";

async function save(page, url: string) {
  await page.getByTestId("url-input").fill(url);
  await page.getByTestId("save-button").click();
}

test("save a keyword+tag search and reapply it in one click", async ({ page }) => {
  await page.goto("/");
  await save(page, "https://ss-a.example/chicken");

  // Tag it "cooking" via edit so we have a tag to filter on.
  await page.getByTestId("bookmark-item").first().getByTestId("edit-button").click();
  await page.getByTestId("tag-input-field").fill("cooking");
  await page.getByTestId("tag-input-field").press("Enter");
  await page.getByTestId("edit-save").click();

  // Set up a search: keyword + tag.
  await page.getByTestId("search-input").fill("chicken");
  await page.getByTestId("tag-filter-cooking").click(); // include cooking

  // Save it.
  await page.getByTestId("save-current-search").click();
  await page.getByTestId("save-search-name").fill("chicken cooking");
  await page.getByTestId("save-search-confirm").click();

  // Clear filters, then reapply the saved search.
  await page.getByTestId("search-input").fill("");
  await page.getByTestId("clear-tag-filters").click();
  await page.getByTestId(/^apply-saved-/).first().click();

  await expect(page.getByTestId("search-input")).toHaveValue("chicken");
  await expect(page.getByTestId("bookmark-item")).toHaveCount(1);
});
