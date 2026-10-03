import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

async function expectNoPageOverflow(page: Page, state: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page, `${state} page width`).toBeLessThanOrEqual(dimensions.viewport);
}

async function prepareBookmark(page: Page, token: string): Promise<string> {
  const title = `${token} Responsive bookmark with a deliberately long title`;
  const response = await page.request.post("/api/bookmarks", {
    data: {
      address: `https://responsive.invalid/${token}/a-long-address-segment-for-overflow-checking`,
      title,
      description: "A long description used to make narrow layout wrapping meaningful.",
      noteMarkdown: "## Reading notes\n\n- First item\n- Second item with **emphasis** and `code`",
      tags: [`${token}-long-tag-name`],
      unread: true,
    },
  });
  expect(response.status()).toBe(201);
  return title;
}

for (const viewport of [
  { name: "320-pixel mobile", width: 320, height: 720 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.name} layouts keep capture, collection, filters, notes, saved views, and bulk controls contained`, async ({
    page,
  }) => {
    const token = `responsive${randomUUID().replaceAll("-", "").slice(0, 10)}`;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
    const title = await prepareBookmark(page, token);
    await page.goto(`/?q=${token}`);
    await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

    await expect(page.getByRole("article", { name: title })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search bookmarks" })).toBeVisible();
    await expectNoPageOverflow(page, `${viewport.name} collection and filters`);

    await page.getByRole("button", { name: "Add bookmark" }).click();
    await expect(page.getByRole("dialog", { name: "Save a bookmark" })).toBeVisible();
    await expectNoPageOverflow(page, `${viewport.name} capture`);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Reading notes" })).toBeVisible();
    await expectNoPageOverflow(page, `${viewport.name} formatted notes`);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Save current" }).click();
    await page.getByRole("textbox", { name: "View name" }).fill(`${token} compact view`);
    await page.getByRole("button", { name: "Save view" }).click();
    await expect(
      page.getByRole("button", { name: `${token} compact view`, exact: true }),
    ).toBeVisible();
    await expectNoPageOverflow(page, `${viewport.name} saved views`);

    await page.getByRole("button", { name: "Select 1 on this page" }).click();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toBeVisible();
    await expectNoPageOverflow(page, `${viewport.name} bulk controls`);
  });
}
