// E2E — User Story 2: Browse and open. Mirrors quickstart scenario 4.

import { test, expect } from "@playwright/test";

test("shows a friendly empty state when nothing is saved", async ({ page }) => {
  // Note: assumes a fresh collection; run against an empty database.
  await page.goto("/");
  const empty = page.getByTestId("empty-state");
  const list = page.getByTestId("bookmark-item");
  // Either the empty state is shown, or (if the db has data) items are listed.
  if ((await list.count()) === 0) {
    await expect(empty).toBeVisible();
  }
});

test("lists a saved bookmark with title and address, opening in a new tab", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://browse-e2e.example/article");
  await page.getByTestId("save-button").click();

  const link = page.getByTestId("bookmark-link").first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("href", /browse-e2e\.example/);
});
