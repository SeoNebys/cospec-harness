import { test, expect } from "@playwright/test";
import { routeMetadata, saveLink } from "./helpers.mjs";

// SCN-003: tags (pick or type) + private Markdown note.
test("add a new tag and a Markdown note", async ({ page }) => {
  await routeMetadata(page);
  await page.goto("/");
  await saveLink(page, "https://example.com/a");

  await page.click('[data-action="organize"]');
  await page.fill(".org-newtag", "testing");
  await page.press(".org-newtag", "Enter");
  await page.fill(".org-note", "**Key idea:** balance\n- fast feedback\n- see [link](https://x.com)");
  await page.click('[data-action="save-org"]');

  await expect(page.locator(".card .tags .chip")).toHaveText("testing");
  const note = page.locator(".card .note");
  await expect(note.locator("strong")).toHaveText("Key idea:");
  await expect(note.locator("li")).toHaveCount(2);
  await expect(note.locator("a")).toHaveAttribute("href", "https://x.com");
});

test("existing tags are offered for reuse across bookmarks", async ({ page }) => {
  await routeMetadata(page, {
    "a.com": { error: false, title: "A", description: "", image: "", favicon: "", host: "a.com" },
    "b.com": { error: false, title: "B", description: "", image: "", favicon: "", host: "b.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://a.com");
  await saveLink(page, "https://b.com");

  // tag the first (top) card = B
  await page.locator(".card").first().locator('[data-action="organize"]').click();
  await page.fill(".org-newtag", "shared");
  await page.press(".org-newtag", "Enter");
  await page.locator(".card").first().locator('[data-action="save-org"]').click();

  // now organize the other card; "shared" should appear as a suggestion chip
  await page.locator(".card").nth(1).locator('[data-action="organize"]').click();
  const suggestion = page.locator('.chip.suggest[data-tag="shared"]');
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await page.locator(".card").nth(1).locator('[data-action="save-org"]').click();

  await expect(page.locator(".card").nth(1).locator(".tags .chip")).toHaveText("shared");
});
