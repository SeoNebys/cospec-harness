import { test, expect } from "@playwright/test";

// US1 — Save a bookmark with automatic details.
// Assumes the dev server (proxying /api to the backend) is running on :5173
// with a clean database.

test("saves a bookmark and shows it in the collection", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://example.com/article-1");
  await page.getByRole("button", { name: "Save" }).click();

  const list = page.getByTestId("bookmark-list");
  await expect(list.getByText("https://example.com/article-1")).toBeVisible();
});

test("a user-provided title takes precedence over the fetched one", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://example.com/mine");
  await page.getByTestId("title-input").fill("My Own Title");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("My Own Title")).toBeVisible();
});

test("rejects an invalid address without saving", async ({ page }) => {
  await page.goto("/");
  // The url input has type=url + required; force an invalid value via a text override.
  await page.getByTestId("url-input").fill("not-a-url");
  await page.getByRole("button", { name: "Save" }).click();
  // Browser URL validation or the API 400 prevents a card from appearing.
  await expect(page.getByTestId("bookmark-card")).toHaveCount(0);
});

test("warns when saving a duplicate and allows saving anyway", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://example.com/dup");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("https://example.com/dup")).toBeVisible();

  await page.getByTestId("url-input").fill("https://example.com/dup");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("duplicate-warning")).toBeVisible();
  await page.getByRole("button", { name: "Save anyway" }).click();

  await expect(page.getByTestId("bookmark-card")).toHaveCount(2);
});
