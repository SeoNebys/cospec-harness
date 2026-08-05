// E2E — User Story 1: Save a bookmark. Mirrors quickstart scenarios 1–3.
// Assumes the app is running at baseURL (backend serving the built frontend).

import { test, expect } from "@playwright/test";

test("saves a valid URL and shows it in the list", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://example.com/");
  await page.getByTestId("save-button").click();
  await expect(page.getByTestId("bookmark-item").first()).toBeVisible();
  await expect(page.getByTestId("bookmark-link").first()).toHaveAttribute(
    "href",
    /example\.com/
  );
});

test("rejects a malformed address with a clear message", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("not a url");
  await page.getByTestId("save-button").click();
  await expect(page.getByTestId("save-error")).toBeVisible();
});

test("re-saving an existing URL does not create a duplicate", async ({ page }) => {
  await page.goto("/");
  const url = "https://dup-e2e.example/page";
  await page.getByTestId("url-input").fill(url);
  await page.getByTestId("save-button").click();
  await page.getByTestId("url-input").fill(url);
  await page.getByTestId("save-button").click();
  await expect(page.getByTestId("notice")).toContainText("Already saved");
});
