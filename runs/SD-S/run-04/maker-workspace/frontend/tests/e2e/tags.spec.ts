import { test, expect } from "@playwright/test";

// US3 — Organize bookmarks with tags. Assumes a clean database.

test("adds tags on save and filters by tag", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("url-input").fill("https://work1.example");
  await page.getByTestId("title-input").fill("Work item");
  await page.getByTestId("tags-input").fill("work");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Work item")).toBeVisible();

  await page.getByTestId("url-input").fill("https://fun1.example");
  await page.getByTestId("title-input").fill("Fun item");
  await page.getByTestId("tags-input").fill("fun");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fun item")).toBeVisible();

  await page.getByTestId("tag-filter-work").click();
  await expect(page.getByTestId("bookmark-card")).toHaveCount(1);
  await expect(page.getByText("Work item")).toBeVisible();
});

test("removes a tag via the edit dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://tagged.example");
  await page.getByTestId("title-input").fill("Tagged");
  await page.getByTestId("tags-input").fill("temp");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("#temp")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByRole("button", { name: "Remove tag temp" }).click();
  await page.getByTestId("edit-save").click();

  await expect(page.getByText("#temp")).toHaveCount(0);
});
