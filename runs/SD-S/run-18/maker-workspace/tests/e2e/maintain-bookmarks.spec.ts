import { expect, test } from "@playwright/test";

test("edits, cancels deletion, then permanently deletes", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("alice@example.test");
  await page.getByLabel("Password").fill("Bookmarks-Alice-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  const unique = Date.now();
  await page.getByLabel("Web address").fill(`https://example.invalid/maintain-${unique}`);
  await page.getByRole("button", { name: "Get page details" }).click();
  await page.getByRole("button", { name: "Save bookmark" }).click();
  const card = page.locator("article", { hasText: `maintain ${unique}` });
  await card.getByRole("button", { name: "Edit" }).click();
  await card.getByLabel("Edit title").fill(`Edited ${unique}`);
  await card.getByLabel("Edit tags").fill("Updated");
  await card.getByLabel("Edit tags").press("Enter");
  await card.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: `Edited ${unique}` })).toBeVisible();
  const updatedCard = page.locator("article", { hasText: `Edited ${unique}` });
  await updatedCard.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Keep bookmark" }).click();
  await expect(updatedCard).toBeVisible();
  await updatedCard.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("heading", { name: `Edited ${unique}` })).toHaveCount(0);
});
