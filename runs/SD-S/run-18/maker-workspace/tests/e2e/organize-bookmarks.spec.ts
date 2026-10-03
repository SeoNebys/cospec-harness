import { expect, test } from "@playwright/test";

test("adds and displays tags", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("alice@example.test");
  await page.getByLabel("Password").fill("Bookmarks-Alice-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Web address").fill("https://example.invalid/tagged-page");
  await page.getByRole("button", { name: "Get page details" }).click();
  await page.getByLabel("Tags", { exact: true }).fill("Research");
  await page.getByLabel("Tags", { exact: true }).press("Enter");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await expect(page.locator(".tag-chip.static", { hasText: "Research" }).first()).toBeVisible();
});
