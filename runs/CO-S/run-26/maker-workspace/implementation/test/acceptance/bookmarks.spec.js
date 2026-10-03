import { test, expect } from "@playwright/test";

// Acceptance tests mapped to approved scenarios (SCN-001..009).
// The app fetches page details from the offline fixture server.
const FIX = "http://127.0.0.1:4100";

async function clearAll(request) {
  const res = await request.get("/api/bookmarks");
  const list = await res.json();
  for (const b of list) await request.delete(`/api/bookmarks/${b.id}`);
}

test.beforeEach(async ({ request, page }) => {
  await clearAll(request);
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-harness-ready", "true");
});

async function saveLink(page, url) {
  const before = await page.locator(".card").count();
  await page.fill("#saveUrl", url);
  await page.click("#saveBtn");
  await expect(page.locator(".card")).toHaveCount(before + 1);
}

test("SCN-006: brand-new user sees a friendly empty state", async ({ page }) => {
  await expect(page.locator(".empty")).toContainText("No bookmarks yet");
});

test("SCN-001: save a link, details auto-fill, newest first", async ({ page }) => {
  await saveLink(page, `${FIX}/react`);
  const card = page.locator(".card").first();
  await expect(card.locator(".title")).toContainText("Introducing Hooks - React");
  await expect(card.locator(".desc")).toContainText("without writing a class");
  await expect(card.locator(".status-pill")).toContainText("To read"); // default (SCN-004)

  await saveLink(page, `${FIX}/nasa`);
  await saveLink(page, `${FIX}/chicken`);
  await expect(page.locator(".card").first().locator(".title")).toContainText("Roast Chicken");
});

test("SCN-007: malformed address is rejected and nothing is saved", async ({ page }) => {
  await page.fill("#saveUrl", "not a real address");
  await page.click("#saveBtn");
  await expect(page.locator("#saveError")).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(0);
});

test("SCN-007: an unreadable page is kept with a warning flag", async ({ page }) => {
  await saveLink(page, `${FIX}/broken`);
  await expect(page.locator(".card").first().locator(".flag")).toBeVisible();
});

test("SCN-007: saving a duplicate points to the existing one, no copy", async ({ page }) => {
  await saveLink(page, `${FIX}/react`);
  await page.fill("#saveUrl", `${FIX}/react`);
  await page.click("#saveBtn");
  await expect(page.locator("#saveInfo")).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(1);
});

test("SCN-002/008: add tags and a note by editing", async ({ page }) => {
  await saveLink(page, `${FIX}/react`);
  await page.getByRole("button", { name: "✎ Edit" }).click();
  const tagField = page.locator(".f-tag");
  await tagField.fill("frontend");
  await tagField.press("Enter");
  await page.locator(".f-note").fill("Re-read before refactoring.");
  await page.getByRole("button", { name: "Save changes" }).click();
  const card = page.locator(".card").first();
  await expect(card.locator(".chip")).toContainText("frontend");
  await expect(card.locator(".note")).toContainText("Re-read before refactoring.");
});

test("SCN-003: search across fields with highlight, and browse by tag", async ({ page }) => {
  await saveLink(page, `${FIX}/react`);
  await saveLink(page, `${FIX}/chicken`);
  // search matches a word only in the description
  await page.fill("#search", "crisp");
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card").first().locator(".title")).toContainText("Roast Chicken");
  await expect(page.locator(".card mark")).toBeVisible(); // highlighted
  await page.fill("#search", "");

  // tag one, then browse by that tag
  await page.locator(".card", { hasText: "Roast Chicken" }).getByRole("button", { name: "✎ Edit" }).click();
  await page.locator(".f-tag").fill("cooking");
  await page.locator(".f-tag").press("Enter");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.locator("#tagFilters .tag-filter", { hasText: "cooking" }).click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card").first().locator(".title")).toContainText("Roast Chicken");
});

test("SCN-004: mark finished and separate via tabs", async ({ page }) => {
  await saveLink(page, `${FIX}/react`);
  await page.getByRole("button", { name: "Mark as finished" }).click();
  await expect(page.locator(".card").first().locator(".status-pill")).toContainText("Finished");
  await page.getByRole("button", { name: /^To read/ }).click();
  await expect(page.locator(".empty")).toBeVisible(); // nothing to read now
  await page.getByRole("button", { name: /^Finished/ }).click();
  await expect(page.locator(".card")).toHaveCount(1);
});

test("SCN-005: archive hides from everyday lists, then restore", async ({ page }) => {
  await saveLink(page, `${FIX}/react`);
  await page.getByRole("button", { name: "🗄 Archive", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(0); // gone from All
  await page.getByRole("button", { name: /Archived/ }).click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".archive-banner")).toBeVisible();
  await page.getByRole("button", { name: "↩ Restore" }).click();
  await page.getByRole("button", { name: /^All/ }).click();
  await expect(page.locator(".card")).toHaveCount(1);
});

test("SCN-008: edit the web address with validation", async ({ page }) => {
  await saveLink(page, `${FIX}/react`);
  await page.getByRole("button", { name: "✎ Edit" }).click();
  await page.locator(".f-url").fill("nope");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".f-url-err")).toBeVisible();
  await page.locator(".f-url").fill(`${FIX}/nasa`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".card").first().locator(".site")).toContainText("127.0.0.1");
});

test("SCN-009: permanent delete asks for confirmation and is distinct from archive", async ({ page }) => {
  await saveLink(page, `${FIX}/react`);
  await page.getByRole("button", { name: "🗑 Delete…" }).click();
  await expect(page.locator(".confirm")).toContainText("permanently");
  await expect(page.locator(".confirm .sub")).toContainText("Archive");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".card")).toHaveCount(1); // cancel keeps it
  await page.getByRole("button", { name: "🗑 Delete…" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.locator(".card")).toHaveCount(0);
});
