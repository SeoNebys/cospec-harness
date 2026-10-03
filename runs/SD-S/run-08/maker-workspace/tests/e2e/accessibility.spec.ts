import { expect, test } from "@playwright/test";
import { scanPage } from "./accessibility";

test("home page has no automatically detectable WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-harness-ready="true"]').waitFor();
  const result = await scanPage(page);
  expect(result.violations).toEqual([]);
});

test("mobile layout remains free of horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
