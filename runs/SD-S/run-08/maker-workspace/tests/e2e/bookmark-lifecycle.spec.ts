import { expect, test } from "@playwright/test";

test("collection and save form are usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keep the links that matter." })).toBeVisible();
  await expect(page.getByLabel("Paste a link to keep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved bookmarks" })).toBeVisible();
});

test("skip link moves focus to the primary content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});

test("preview, save, edit, and confirmed delete form a complete journey", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const url = `https://example.test/${suffix}`;
  const fetchedTitle = `Fetched ${suffix}`;
  const editedTitle = `Edited ${suffix}`;

  await page.route("**/api/metadata", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      normalizedUrl: url,
      title: fetchedTitle,
      titleOrigin: "fetched",
      iconToken: null,
      warning: null,
      existingBookmarkId: null
    }) });
  });
  await page.goto("/");
  await page.getByLabel("Paste a link to keep").fill(url);
  await page.getByRole("button", { name: "Preview link" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(fetchedTitle);
  await page.getByLabel("Title").fill(editedTitle);
  await page.getByLabel(/Note/).fill("A browser-tested note");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  const savedCard = page.getByRole("article").filter({ has: page.getByRole("link", { name: new RegExp(editedTitle) }) });
  await expect(savedCard).toBeVisible();

  await savedCard.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Title")).toHaveValue(editedTitle);
  await page.getByLabel("Title").fill(`${editedTitle} updated`);
  await page.getByRole("button", { name: "Save changes" }).click();
  const updatedCard = page.getByRole("article").filter({ has: page.getByRole("link", { name: new RegExp(`${editedTitle} updated`) }) });
  await expect(updatedCard).toBeVisible();

  await updatedCard.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.getByRole("button", { name: "Cancel" }).click();
  await updatedCard.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete bookmark" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`${editedTitle} updated`) })).toHaveCount(0);
});
