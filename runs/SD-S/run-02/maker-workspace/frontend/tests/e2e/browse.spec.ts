import { test, expect } from "@playwright/test";

/**
 * End-to-end journey for User Stories 1 & 2: save a bookmark, reload, see it
 * listed, and confirm it links to the original page.
 *
 * Prerequisites: backend running (with a disposable DB) and frontend dev server
 * running with /api proxied to it. Run via `npm run e2e`.
 */
test("save a bookmark, reload, and see it listed with an opening link", async ({
  page,
}) => {
  await page.goto("/");

  const url = `https://example.com/e2e-${Date.now()}`;
  await page.getByLabel("Address").fill(url);
  await page.getByLabel("Title").fill("E2E Bookmark");
  await page.getByRole("button", { name: /save bookmark/i }).click();

  // Appears in the list.
  const item = page.getByTestId("bookmark").filter({ hasText: "E2E Bookmark" });
  await expect(item).toBeVisible();

  // Persists across a reload.
  await page.reload();
  const itemAfter = page.getByTestId("bookmark").filter({ hasText: "E2E Bookmark" });
  await expect(itemAfter).toBeVisible();

  // Links to the original address.
  await expect(itemAfter.getByRole("link", { name: "E2E Bookmark" })).toHaveAttribute(
    "href",
    url,
  );
});
