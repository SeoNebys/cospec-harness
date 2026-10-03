import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function expectAccessible(page: Page, state: string): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations,
    `${state}: ${result.violations
      .map((violation) => `${violation.id} (${violation.nodes.length})`)
      .join(", ")}`,
  ).toEqual([]);
}

async function waitUntilReady(page: Page): Promise<void> {
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
}

test("core empty, populated, filtered, detail, Read Later, archived, saved-view, and bulk states are accessible", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const token = `a11y${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const title = `${token} Accessible article`;
  const address = `https://accessibility.invalid/${token}`;

  await page.goto(`/?q=${token}-empty`);
  await waitUntilReady(page);
  await expect(page.getByRole("heading", { name: "No bookmarks match this view" })).toBeVisible();
  await expectAccessible(page, "filtered empty collection");

  await page.goto("/");
  await waitUntilReady(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to collection" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const add = page.getByRole("button", { name: "Add bookmark" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Save a bookmark" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /web address/i })).toBeFocused();
  await expectAccessible(page, "capture dialog");
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();

  const created = await page.request.post("/api/bookmarks", {
    data: {
      address,
      title,
      description: "Accessible testing fixture",
      noteMarkdown: "## Notes\n\nA **formatted** note with [safe link](https://example.com).",
      tags: [`${token}-tag`],
      favorite: true,
      unread: true,
    },
  });
  expect(created.status()).toBe(201);
  const bookmarkId = (await created.json()).id as number;

  await page.goto(`/?q=${token}`);
  await waitUntilReady(page);
  await expect(page.getByRole("article", { name: title })).toBeVisible();
  await expectAccessible(page, "populated filtered collection");

  const titleButton = page.getByRole("button", { name: title, exact: true });
  await titleButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
  await expectAccessible(page, "bookmark detail dialog");
  await page.getByRole("button", { name: "Edit bookmark" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: `Edit ${title}` })).toBeVisible();
  await expectAccessible(page, "bookmark editor dialog");
  await page.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: title, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: /Read later/i }).click();
  await waitUntilReady(page);
  await expect(page.getByRole("article", { name: title })).toBeVisible();
  await expectAccessible(page, "Read Later collection");

  const archived = await page.request.patch(`/api/bookmarks/${bookmarkId}`, {
    data: { archived: true },
  });
  expect(archived.ok()).toBeTruthy();
  await page.getByRole("link", { name: "Archive" }).click();
  await waitUntilReady(page);
  await expect(page.getByRole("article", { name: title })).toBeVisible();
  await expectAccessible(page, "archived collection");

  await page.getByRole("button", { name: "Save current" }).click();
  await expectAccessible(page, "saved-view dialog");
  await page.getByRole("textbox", { name: "View name" }).fill(`${token} view`);
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("button", { name: `${token} view`, exact: true })).toBeVisible();
  await expectAccessible(page, "saved-view navigation");

  const restored = await page.request.patch(`/api/bookmarks/${bookmarkId}`, {
    data: { archived: false },
  });
  expect(restored.ok()).toBeTruthy();
  await page.goto(`/?q=${token}`);
  await waitUntilReady(page);
  await page.getByRole("button", { name: "Select 1 on this page" }).click();
  await expect(page.getByRole("region", { name: "Bulk actions" })).toBeVisible();
  await expectAccessible(page, "bulk action controls");

  const deleteTrigger = page.getByRole("button", { name: "Permanently delete" });
  await deleteTrigger.focus();
  await page.keyboard.press("Enter");
  const deleteDialog = page.getByRole("dialog", { name: "Delete 1 bookmark?" });
  await expect(deleteDialog).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(deleteDialog).toContainText("cannot be undone");
  expect(await deleteDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(
    true,
  );
  await expectAccessible(page, "bulk deletion confirmation");
  await page.keyboard.press("Escape");
  await expect(deleteTrigger).toBeFocused();
});
