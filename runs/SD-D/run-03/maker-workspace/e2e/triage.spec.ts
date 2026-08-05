// E2E — User Story 5: read-later + archive. Mirrors quickstart 12.

import { test, expect } from "@playwright/test";

async function save(page, url: string) {
  await page.getByTestId("url-input").fill(url);
  await page.getByTestId("save-button").click();
}

test("read-later is opt-in: flag it, then clear it", async ({ page }) => {
  await page.goto("/");
  await save(page, "https://triage-a.example/x");
  // New saves default to read → the read-later pile starts empty.
  await page.getByTestId("view-unread").click();
  await expect(page.getByTestId("bookmark-item").filter({ hasText: "triage-a" })).toHaveCount(0);

  // Flag it for read-later from the All view.
  await page.getByTestId("view-all").click();
  const item = page.getByTestId("bookmark-item").filter({ hasText: "triage-a" });
  await item.getByTestId("toggle-read").click(); // "Mark unread" → flags read-later
  await page.getByTestId("view-unread").click();
  await expect(page.getByTestId("bookmark-item").filter({ hasText: "triage-a" })).toBeVisible();
});

test("archive removes from main list, restore brings it back", async ({ page }) => {
  await page.goto("/");
  await save(page, "https://triage-b.example/y");
  const item = page.getByTestId("bookmark-item").filter({ hasText: "triage-b" });
  await item.getByTestId("archive-toggle").click();
  // Gone from main (All) list.
  await expect(page.getByTestId("bookmark-item").filter({ hasText: "triage-b" })).toHaveCount(0);
  // Present in Archive, then restore.
  await page.getByTestId("view-archive").click();
  const archived = page.getByTestId("bookmark-item").filter({ hasText: "triage-b" });
  await expect(archived).toBeVisible();
  await archived.getByTestId("archive-toggle").click();
  await page.getByTestId("view-all").click();
  await expect(page.getByTestId("bookmark-item").filter({ hasText: "triage-b" })).toBeVisible();
});
