import { expect, test } from "@playwright/test";

test("blocked metadata destinations fall back safely and remain saveable", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("alice@example.test");
  await page.getByLabel("Password").fill("Bookmarks-Alice-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Web address").fill(`http://127.0.0.1/private-${Date.now()}`);
  await page.getByRole("button", { name: "Get page details" }).click();
  await expect(page.getByRole("status")).toContainText("made a title");
  await expect(page.getByLabel("Title")).not.toHaveValue("");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
});
