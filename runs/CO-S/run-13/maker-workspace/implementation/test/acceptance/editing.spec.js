import { test, expect } from "@playwright/test";
import { resetAndOpen, seed, cardByTitle } from "./helpers.js";

test("SCN-011: a brand-new empty library shows a welcoming message", async ({ page, request }) => {
  await resetAndOpen(page, request);
  await expect(page.locator("li.bm-item")).toHaveCount(0);
  await expect(page.locator("#empty")).toContainText("No bookmarks yet");
  await expect(page.locator('#viewTabs [data-view="all"]')).toContainText("0");
});

test("SCN-009: saving a link that already exists opens the existing one for editing", async ({ page, request }) => {
  await request.post("/api/__test/reset");
  const existing = await seed(request, { url: "https://dup.example.com/x", title: "Existing One" });
  await page.goto("/");
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  await page.fill("#url", "https://dup.example.com/x");
  await page.fill("#title", "Attempted Copy");
  await page.click("#saveBtn");

  await expect(page.locator("li.bm-item")).toHaveCount(1); // no second copy
  await expect(page.locator("#flash")).toContainText("already saved");
  await expect(page.locator(`li.bm-item[data-id="${existing.id}"].editing`)).toBeVisible();
});

test("SCN-009: a duplicate that lives in Archived switches to that tab", async ({ page, request }) => {
  await request.post("/api/__test/reset");
  const arch = await seed(request, { url: "https://arch.example.com/y", title: "Archived One" });
  await request.patch(`/api/bookmarks/${arch.id}`, { data: { archived: true } });
  await page.goto("/");
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  await page.fill("#url", "https://arch.example.com/y");
  await page.fill("#title", "Attempt");
  await page.click("#saveBtn");

  await expect(page.locator("#flash")).toContainText("Archived");
  await expect(page.locator('#viewTabs [data-view="archived"].active')).toBeVisible();
  await expect(page.locator(`li.bm-item[data-id="${arch.id}"].editing`)).toBeVisible();
});

test("SCN-008: edit title, tags and address; site follows the new address", async ({ page, request }) => {
  await request.post("/api/__test/reset");
  await seed(request, { url: "https://old.example.com/p", title: "Before", tags: "a", site: "Old" });
  await page.goto("/");
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  await cardByTitle(page, "Before").locator('[data-act="edit"]').click();
  const editing = page.locator("li.bm-item.editing");
  await editing.locator(".ed-title").fill("After");
  await editing.locator(".ed-tags").fill("a, b");
  await editing.locator(".ed-url").fill("https://new.example.org/q");
  await editing.locator('[data-act="edit-save"]').click();

  const card = cardByTitle(page, "After");
  await expect(card).toBeVisible();
  await expect(card.locator(".site")).toContainText("new.example.org");
  await expect(card.locator(".tag")).toHaveText(["a", "b"]);
  await expect(page.locator("#flash")).toContainText("Changes saved");
});

test("SCN-008: editing an address to one another bookmark uses is blocked", async ({ page, request }) => {
  await request.post("/api/__test/reset");
  await seed(request, { url: "https://one.example.com", title: "One" });
  await seed(request, { url: "https://two.example.com", title: "Two" });
  await page.goto("/");
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  await cardByTitle(page, "Two").locator('[data-act="edit"]').click();
  const editing = page.locator("li.bm-item.editing");
  await editing.locator(".ed-url").fill("https://one.example.com");
  await editing.locator('[data-act="edit-save"]').click();
  await expect(editing.locator(".ed-error")).toContainText("Another bookmark already uses that address");
  // still editing, no change committed
  await expect(page.locator("li.bm-item.editing")).toBeVisible();
});

test("SCN-012: very long content and many tags wrap inside the card", async ({ page, request }) => {
  await request.post("/api/__test/reset");
  await seed(request, {
    url: "https://example.com/very/deep/" + "segment-".repeat(12) + "end?a=1&b=2&c=3",
    title: "An Unusually Long Bookmark Title That Keeps Going And Going Across Several Lines To Test Wrapping",
    description: "A long description. ".repeat(8),
    note: "A long note that should wrap neatly. ".repeat(4),
    tags: "reading, reference, design, work, cli, research, longform, revisit, misc, twenty-twenty-six",
  });
  await page.goto("/");
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  const card = page.locator("li.bm-item").first();
  await expect(card.locator(".tag")).toHaveCount(10);
  const fits = await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(fits).toBe(true);
});
