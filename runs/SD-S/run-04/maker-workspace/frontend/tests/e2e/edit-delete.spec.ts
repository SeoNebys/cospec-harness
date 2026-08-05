import { test, expect } from "@playwright/test";

// US4 — Edit and delete bookmarks. Assumes a clean database.

test("edits a bookmark's title and the change persists", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://edit.example");
  await page.getByTestId("title-input").fill("Before");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Before")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByTestId("edit-title").fill("After");
  await page.getByTestId("edit-save").click();
  await expect(page.getByText("After")).toBeVisible();

  // Persistence across reload.
  await page.reload();
  await expect(page.getByText("After")).toBeVisible();
});

test("deletes a bookmark only after explicit confirmation", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://delete.example");
  await page.getByTestId("title-input").fill("To remove");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("To remove")).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).first().click();
  await expect(page.getByTestId("confirm-dialog")).toBeVisible();
  await page.getByTestId("confirm-delete").click();

  await expect(page.getByText("To remove")).toHaveCount(0);
  await expect(page.getByTestId("empty-collection")).toBeVisible();
});
