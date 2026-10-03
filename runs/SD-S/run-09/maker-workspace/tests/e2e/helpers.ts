import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page) {
  await page.goto("/");
  if (await page.getByLabel("Email").isVisible().catch(() => false)) {
    await page.getByLabel("Email").fill("review@example.test");
    await page.getByLabel("Password").fill("bookmark-review-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Save something worth keeping" })).toBeVisible();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
}

export async function saveUrl(page: Page, url: string) {
  await page.getByLabel("Web address").fill(url);
  await expect(page.getByLabel("Bookmark title")).toBeVisible();
  await page.getByRole("button", { name: "Save link" }).click();
}
