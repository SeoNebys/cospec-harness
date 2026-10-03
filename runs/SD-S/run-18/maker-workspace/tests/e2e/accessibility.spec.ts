import { expect, test } from "@playwright/test";

test("sign-in and library expose keyboard-friendly responsive landmarks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.getByLabel("Email").fill("alice@example.test");
  await page.getByLabel("Password").fill("Bookmarks-Alice-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator(".status-region")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const duration = await page.evaluate(() => {
    const element = document.querySelector(".bookmark-card") ?? document.querySelector(".button");
    return element ? getComputedStyle(element).transitionDuration : "0s";
  });
  expect(["0s", "0.01ms", "0.001s", "1e-05s"]).toContain(duration);
});
