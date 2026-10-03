import { test, expect } from "@playwright/test";
import { routeMetadata, saveLink } from "./helpers.mjs";

// SCN-010: partial details and long text.
test("missing description and image are omitted quietly", async ({ page }) => {
  await routeMetadata(page, {
    "minimal.com": { error: false, title: "Minimal", description: "", image: "", favicon: "", host: "minimal.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://minimal.com");
  await expect(page.locator(".card .title")).toHaveText("Minimal");
  await expect(page.locator(".card .desc")).toHaveCount(0);
});

test("very long description is clamped to about three lines", async ({ page }) => {
  const long = "word ".repeat(400);
  await routeMetadata(page, {
    "long.com": { error: false, title: "Long", description: long, image: "", favicon: "", host: "long.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://long.com");
  const box = await page.locator(".card .desc").boundingBox();
  // ~3 lines at 13.5px / 1.45 line-height ≈ under 70px
  expect(box.height).toBeLessThan(72);
});

// SCN-011: empty states + invalid input.
test("new-user empty state invites first save", async ({ page }) => {
  await routeMetadata(page);
  await page.goto("/");
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator("#empty")).toContainText("No bookmarks yet");
});

test("invalid link is rejected with a helpful message", async ({ page }) => {
  await routeMetadata(page);
  await page.goto("/");
  await page.fill("#urlInput", "not a real link");
  await page.click("#saveBtn");
  await expect(page.locator("#notice")).toContainText("valid link");
  await expect(page.locator(".card")).toHaveCount(0);
});

test("empty save box does nothing", async ({ page }) => {
  await routeMetadata(page);
  await page.goto("/");
  await page.click("#saveBtn");
  await expect(page.locator(".card")).toHaveCount(0);
  await expect(page.locator("#notice")).toBeHidden();
});
