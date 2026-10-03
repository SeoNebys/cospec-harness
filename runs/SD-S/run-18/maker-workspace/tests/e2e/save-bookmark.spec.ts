import { expect, test } from "@playwright/test";

test("saves a URL with a fallback title and catches duplicates", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("alice@example.test");
  await page.getByLabel("Password").fill("Bookmarks-Alice-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Web address").fill("https://example.invalid/article-one");
  await page.getByRole("button", { name: "Get page details" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("example.invalid — article one");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await expect(page.getByRole("heading", { name: "example.invalid — article one" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "example.invalid — article one" })).toBeVisible();
});
