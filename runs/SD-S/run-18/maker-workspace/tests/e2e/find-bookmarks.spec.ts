import { expect, test } from "@playwright/test";

test("searches and filters the private library with recoverable no-results", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("alice@example.test");
  await page.getByLabel("Password").fill("Bookmarks-Alice-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  const unique = Date.now();
  await page.getByLabel("Web address").fill(`https://example.invalid/search-${unique}`);
  await page.getByRole("button", { name: "Get page details" }).click();
  await page.getByLabel("Tags", { exact: true }).fill("Research");
  await page.getByLabel("Tags", { exact: true }).press("Enter");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await page.getByRole("searchbox").fill(`search ${unique}`);
  await expect(page).toHaveURL(/query=search/);
  await expect(page.getByRole("heading", { name: new RegExp(`search ${unique}`, "i") })).toBeVisible();
  await page.getByRole("combobox", { name: "Filter by tag" }).selectOption("Research");
  await expect(page).toHaveURL(/tag=Research/);
  await page.getByRole("searchbox").fill("no-such-bookmark-value");
  await expect(page.getByText("No bookmarks match.")).toBeVisible();
  await page.getByRole("button", { name: "Clear search and filters" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
});
