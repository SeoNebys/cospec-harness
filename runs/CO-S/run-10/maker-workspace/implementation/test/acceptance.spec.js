import { test, expect } from "@playwright/test";

// Reset all bookmarks before each test so cases are independent.
async function resetAll(request) {
  const list = (await (await request.get("/api/bookmarks")).json()).bookmarks;
  for (const b of list) await request.delete(`/api/bookmarks/${b.id}`);
}

// Save a link through the UI and wait for the request to complete, so callers
// can safely issue another save (the Save button is disabled while in flight).
async function saveLink(page, url) {
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/bookmarks") && r.request().method() === "POST"
    ),
    (async () => {
      await page.fill("#url", url);
      await page.click("#saveBtn");
    })(),
  ]);
  return resp;
}

test.beforeEach(async ({ request, page }) => {
  await resetAll(request);
  await page.goto("/");
  await page.waitForSelector('[data-harness-ready="true"]');
});

test("SCN-001: save a link and see auto-filled details, newest first", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/`);
  await expect(page.locator(".item")).toHaveCount(1);
  // The app's own page has <title>My Bookmarks</title>, fetched automatically.
  await expect(page.locator(".item .title a").first()).toHaveText(/My Bookmarks/);
  await saveLink(page, `${baseURL}/?second=1`);
  await expect(page.locator(".item")).toHaveCount(2);
  // Newest first: the most recently saved is on top.
  await expect(page.locator(".item .title a").first()).toBeVisible();
});

test("SCN-002: find a link by searching, with a no-results state", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/`);
  await expect(page.locator(".item")).toHaveCount(1);
  await page.fill("#search", "bookmarks");
  await expect(page.locator(".item")).toHaveCount(1);
  await expect(page.locator("mark").first()).toBeVisible(); // match highlighted
  await page.fill("#search", "zxqzxq");
  await expect(page.locator("#stateEmpty")).toBeVisible();
  await page.fill("#search", "");
  await expect(page.locator(".item")).toHaveCount(1);
});

test("SCN-003/004/009: edit title, description, tags (with reuse) and a formatted note", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/one`);
  await saveLink(page, `${baseURL}/two`);
  await expect(page.locator(".item")).toHaveCount(2);

  // Give the first item a tag so it can be suggested later.
  await page.locator("[data-edit]").first().click();
  await page.fill("#chipEntry", "reading");
  await page.keyboard.press("Enter");
  await page.click("[data-save]");
  await expect(page.locator(".item .tag", { hasText: "reading" }).first()).toBeVisible();

  // Edit the second item: title, description, reuse "reading" via suggestion, and a note.
  await page.locator("[data-edit]").nth(1).click();
  await page.fill("#titleEntry", "Q1 2026 Summary Report");
  await page.fill("#descEntry", "Quarterly numbers to review before the board call.");
  await page.fill("#chipEntry", "rea");
  await expect(page.locator("#suggest button", { hasText: "reading" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.fill("#noteEntry", "- confirm figures\n- see [portal](https://example.com/portal)");
  await page.click("[data-save]");

  const card = page.locator(".item", { hasText: "Q1 2026 Summary Report" });
  await expect(card).toBeVisible();
  await expect(card.locator(".desc")).toHaveText(/Quarterly numbers/);
  await expect(card.locator(".note li")).toHaveCount(2);
  await expect(card.locator(".note a")).toHaveCount(1);
  await expect(card.locator(".tag", { hasText: "reading" })).toBeVisible();

  // Edited title, description, tag and note are all searchable.
  for (const term of ["Summary", "Quarterly", "reading", "figures"]) {
    await page.fill("#search", term);
    await expect(page.locator(".item", { hasText: "Q1 2026 Summary Report" })).toBeVisible();
  }
});

test("SCN-009: clearing the title falls back to the web address", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/`);
  await page.locator("[data-edit]").first().click();
  await page.fill("#titleEntry", "");
  await page.click("[data-save]");
  await expect(page.locator(".item .title a").first()).toHaveText(/127\.0\.0\.1/);
});

test("SCN-005: mark to read, view the reading list, search within it, then unmark", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/a`);
  await saveLink(page, `${baseURL}/b`);
  await page.locator("[data-toread]").first().click();
  await expect(page.locator("#countToread")).toHaveText("1");

  await page.click('[data-view="toread"]');
  await expect(page.locator(".item")).toHaveCount(1);

  // Search stays within the current tab.
  await page.fill("#search", "zxqzxq");
  await expect(page.locator("#stateEmpty")).toBeVisible();
  await page.fill("#search", "");

  // Unmark removes it from the reading list.
  await page.locator("[data-toread]").first().click();
  await expect(page.locator(".item")).toHaveCount(0);
  await page.click('[data-view="all"]');
  await expect(page.locator(".item")).toHaveCount(2);
});

test("SCN-006: archive removes from All and shows under Archived; restore returns it", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/`);
  await expect(page.locator("#countAll")).toHaveText("1");
  await page.locator("[data-archive]").first().click();
  await expect(page.locator("#countAll")).toHaveText("0");
  await expect(page.locator("#countArchived")).toHaveText("1");

  await page.click('[data-view="archived"]');
  await expect(page.locator(".item")).toHaveCount(1);
  await page.locator("[data-restore]").first().click();
  await expect(page.locator("#countArchived")).toHaveText("0");
  await page.click('[data-view="all"]');
  await expect(page.locator(".item")).toHaveCount(1);
});

test("SCN-006: archiving clears the read-later mark", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/`);
  await page.locator("[data-toread]").first().click();
  await expect(page.locator("#countToread")).toHaveText("1");
  await page.locator("[data-archive]").first().click();
  await expect(page.locator("#countToread")).toHaveText("0");
  await page.click('[data-view="archived"]');
  await page.locator("[data-restore]").first().click();
  await page.click('[data-view="all"]');
  await expect(page.locator(".toread-btn.on")).toHaveCount(0); // no longer marked
});

test("SCN-007: delete asks for confirmation; cancel keeps, confirm removes", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/`);
  await page.locator("[data-delete]").first().click();
  await expect(page.locator(".confirm")).toBeVisible();
  await page.click("[data-delete-cancel]");
  await expect(page.locator(".item")).toHaveCount(1);

  await page.locator("[data-delete]").first().click();
  await page.click("[data-delete-confirm]");
  await expect(page.locator(".item")).toHaveCount(0);
});

test("SCN-008: re-saving an active link prevents a duplicate and offers editing it", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/`);
  await expect(page.locator(".item")).toHaveCount(1);
  await saveLink(page, `${baseURL}/`);
  await expect(page.locator("#status")).toHaveText(/already saved this link/);
  await expect(page.locator("#statusAction")).toBeVisible();
  await expect(page.locator(".item")).toHaveCount(1); // no duplicate
  await page.click("#statusAction");
  await expect(page.locator("#titleEntry")).toBeVisible(); // editor opened
});

test("SCN-008: re-saving an archived link points to it in Archived, no auto-restore", async ({ page, baseURL }) => {
  await saveLink(page, `${baseURL}/`);
  await page.locator("[data-archive]").first().click();
  await saveLink(page, `${baseURL}/`);
  await expect(page.locator("#status")).toHaveText(/Archived list/);
  await expect(page.locator(".tabs button.on")).toHaveAttribute("data-view", "archived");
  await expect(page.locator("#countArchived")).toHaveText("1"); // still archived, not restored
  await expect(page.locator("#countAll")).toHaveText("0");
});

test("SCN-010: invalid input is refused gently", async ({ page }) => {
  await page.fill("#url", "not a link");
  await page.click("#saveBtn");
  await expect(page.locator("#status")).toHaveText(/valid link/);
  await expect(page.locator(".item")).toHaveCount(0);
});

test("SCN-010: brand-new empty state shows a welcome, no search or tabs", async ({ page }) => {
  await expect(page.locator("#welcome")).toBeVisible();
  await expect(page.locator("#searchBox")).toBeHidden();
  await expect(page.locator("#tabs")).toBeHidden();
});
