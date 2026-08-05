import { test, expect } from "@playwright/test";

// US2 — Browse and find saved bookmarks. Assumes a clean database.

test("shows a helpful empty state for a new collection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("empty-collection")).toBeVisible();
});

test("lists newest bookmarks first", async ({ page }) => {
  await page.goto("/");
  for (const [i, u] of ["https://one.example", "https://two.example", "https://three.example"].entries()) {
    await page.getByTestId("url-input").fill(u);
    await page.getByTestId("title-input").fill(`Item ${i + 1}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(`Item ${i + 1}`)).toBeVisible();
  }
  const titles = await page.getByTestId("bookmark-card").locator(".title").allInnerTexts();
  expect(titles).toEqual(["Item 3", "Item 2", "Item 1"]);
});

test("search narrows to matching bookmarks and shows no-results when nothing matches", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://cooking.example");
  await page.getByTestId("title-input").fill("Cooking recipes");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByTestId("url-input").fill("https://travel.example");
  await page.getByTestId("title-input").fill("Travel guide");
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByTestId("search-input").fill("cooking");
  await expect(page.getByTestId("bookmark-card")).toHaveCount(1);
  await expect(page.getByText("Cooking recipes")).toBeVisible();

  await page.getByTestId("search-input").fill("nonexistentterm");
  await expect(page.getByTestId("no-results")).toBeVisible();
});
