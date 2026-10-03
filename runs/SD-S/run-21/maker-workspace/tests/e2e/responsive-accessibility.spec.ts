import { test, expect } from "@playwright/test";
test("shell exposes navigation and ready state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Bookmark views" })
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
