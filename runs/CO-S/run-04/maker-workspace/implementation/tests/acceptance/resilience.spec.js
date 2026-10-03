import { test, expect } from "@playwright/test";
import { routeMetadata, saveLink } from "./helpers.mjs";

// SCN-008: fetch failure still saves the link, with warning + retry.
test("failed detail fetch still saves the link", async ({ page }) => {
  await routeMetadata(page, {}, { failUnknown: true });
  await page.goto("/");
  await saveLink(page, "https://broken.example.com/gone");

  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".fetchwarn")).toBeVisible();
  await expect(page.locator(".card .title")).toContainText("broken.example.com");
  await expect(page.locator('[data-action="retry"]')).toBeVisible();
});

test("retry succeeds after a transient failure", async ({ page }) => {
  let attempt = 0;
  await page.route("**/api/metadata**", async (route) => {
    attempt += 1;
    const body = attempt === 1
      ? { error: true, host: "flaky.com" }
      : { error: false, title: "Recovered", description: "now works", image: "", favicon: "", host: "flaky.com" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/");
  await saveLink(page, "https://flaky.com/x");
  await expect(page.locator(".fetchwarn")).toBeVisible();

  await page.click('[data-action="retry"]');
  await page.waitForFunction(() => document.querySelectorAll(".card.pending").length === 0);
  await expect(page.locator(".card .title")).toHaveText("Recovered");
  await expect(page.locator(".fetchwarn")).toHaveCount(0);
});

// SCN-009: duplicates are not created.
test("saving a duplicate does not create a second copy", async ({ page }) => {
  await routeMetadata(page, { "dup.com": { error: false, title: "Dup", description: "", image: "", favicon: "", host: "dup.com" } });
  await page.goto("/");
  await saveLink(page, "https://dup.com/a");

  await page.fill("#urlInput", "https://dup.com/a/"); // trailing slash variant
  await page.click("#saveBtn");
  await expect(page.locator("#notice")).toBeVisible();
  await expect(page.locator("#notice")).toContainText("already saved");
  await expect(page.locator(".card")).toHaveCount(1);

  await page.click("#notice button"); // Show it
  await expect(page.locator(".card.flash")).toHaveCount(1);
});

test("archived duplicate is reported and revealed in Archive", async ({ page }) => {
  await routeMetadata(page, { "dup.com": { error: false, title: "Dup", description: "", image: "", favicon: "", host: "dup.com" } });
  await page.goto("/");
  await saveLink(page, "https://dup.com/a");
  await page.click('[data-action="archive"]');

  await page.fill("#urlInput", "https://dup.com/a");
  await page.click("#saveBtn");
  await expect(page.locator("#notice")).toContainText("Archive");
  await page.click("#notice button");
  await expect(page.locator('[data-view="archive"]')).toHaveClass(/on/);
  await expect(page.locator(".card .title")).toHaveText("Dup");
});
