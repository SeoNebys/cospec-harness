// E2E — User Story 3: organise, search, edit, delete. Mirrors quickstart 5–9.

import { test, expect } from "@playwright/test";

async function save(page, url: string) {
  await page.getByTestId("url-input").fill(url);
  await page.getByTestId("save-button").click();
}

test("search narrows the list case-insensitively", async ({ page }) => {
  await page.goto("/");
  await save(page, "https://search-a.example/chicken");
  await save(page, "https://search-b.example/beef");
  await page.getByTestId("search-input").fill("CHICKEN");
  await expect(page.getByTestId("bookmark-item")).toHaveCount(1);
});

test("edit adds a tag which then shows on the item", async ({ page }) => {
  await page.goto("/");
  await save(page, "https://edit-e2e.example/page");
  await page.getByTestId("bookmark-item").first().getByTestId("edit-button").click();
  await page.getByTestId("edit-title").fill("Tagged Item");
  await page.getByTestId("tag-input-field").fill("recipes");
  await page.getByTestId("tag-input-field").press("Enter");
  await page.getByTestId("edit-save").click();
  await expect(page.getByTestId("bookmark-tags").first()).toContainText("recipes");
});

test("re-saving an existing link opens it in edit mode", async ({ page }) => {
  await page.goto("/");
  const url = "https://resave-e2e.example/x";
  await save(page, url);
  await save(page, url);
  await expect(page.getByTestId("edit-panel")).toBeVisible();
  await expect(page.getByTestId("resave-notice")).toBeVisible();
});

test("delete asks for confirmation then removes", async ({ page }) => {
  await page.goto("/");
  await save(page, "https://delete-e2e.example/gone");
  const item = page.getByTestId("bookmark-item").filter({ hasText: "delete-e2e" });
  await item.getByTestId("delete-button").click();
  await expect(page.getByTestId("confirm-dialog")).toBeVisible();
  await page.getByTestId("confirm-delete").click();
  await expect(page.getByTestId("bookmark-item").filter({ hasText: "delete-e2e" })).toHaveCount(0);
});
