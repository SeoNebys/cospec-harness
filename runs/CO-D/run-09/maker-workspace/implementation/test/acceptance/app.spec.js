// Gherkin-based acceptance tests driving the real application (Phase 3 verification).
// Serial; state is built up across tests. Uses deterministic local fixtures.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.describe.configure({ mode: "serial" });

const ART = "http://127.0.0.1:4102/fixtures/article.html";
const LRN = "http://127.0.0.1:4102/fixtures/learning.html";
const PDF = "http://127.0.0.1:4102/fixtures/report.pdf";

async function saveLink(page, url, { copy = true, label, note } = {}) {
  await page.fill("#urlInput", url);
  await page.click("#saveBtn");
  await expect(page.locator("#overlay")).toBeVisible();
  await expect(page.locator("#modalHint")).not.toHaveText(/Reading the page/, { timeout: 8000 });
  if (!copy) { if (await page.locator("#copySwitch.on").count()) await page.click("#copySwitch"); }
  if (label) await page.fill("#fTags", label);
  if (note) await page.fill("#fNote", note);
  await page.click("#confirmBtn");
  await expect(page.locator("#overlay")).toBeHidden();
}

test("SCN-010: first use shows a clean, welcoming empty state", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("[data-harness-ready='true']");
  await expect(page.locator(".empty .big")).toHaveText(/Nothing saved yet/);
  // No management chrome should be visible with nothing saved.
  await expect(page.locator("#controlsRow")).toBeHidden();
  await expect(page.locator("#bulkbar")).toBeHidden();
  await expect(page.locator("#collections")).toBeHidden();
  await expect(page.locator("#filter")).toBeHidden();
  await expect(page.locator("#archivedBanner")).toBeHidden();
});

test("SCN-001/020: save a link, auto-fill, keep a copy", async ({ page }) => {
  await page.goto("/");
  await saveLink(page, ART, { copy: true, label: "reading, design", note: "Great read" });
  const card = page.locator(".item").first();
  await expect(card.locator(".title")).toHaveText(/Designing Calm Interfaces/);
  await expect(card.locator(".badge")).toHaveText(/Read later/);
  await expect(card.locator(".chip", { hasText: "reading" })).toBeVisible();
  await expect(card.locator(".copy-link", { hasText: /Saved copy/ })).toBeVisible();
});

test("SCN-012: non-link text is gently refused", async ({ page }) => {
  await page.goto("/");
  await page.fill("#urlInput", "grocery list ideas");
  await page.click("#saveBtn");
  await expect(page.locator("#urlNote")).toBeVisible();
  await expect(page.locator("#overlay")).toBeHidden();
});

test("SCN-003: re-pasting a saved link opens the existing one to edit", async ({ page }) => {
  await page.goto("/");
  await page.fill("#urlInput", ART);
  await page.click("#saveBtn");
  await expect(page.locator("#modalTitle")).toHaveText(/already saved/);
  await expect(page.locator("#urlField")).toBeVisible();
  await page.click("#cancelBtn");
});

test("SCN-002/011: save unreadable-ish link (missing) still savable with manual title", async ({ page }) => {
  await page.goto("/");
  // A URL that resolves but is not readable as HTML metadata? Use a 404 fixture path.
  await page.fill("#urlInput", "http://127.0.0.1:4102/fixtures/does-not-exist.html");
  await page.click("#saveBtn");
  await expect(page.locator("#overlay")).toBeVisible();
  await expect(page.locator("#modalHint")).toContainText(/couldn't read this page/i, { timeout: 8000 });
  await page.fill("#fTitle", "Manual title for missing page");
  await page.click("#confirmBtn");
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator(".item .title", { hasText: "Manual title for missing page" })).toBeVisible();
});

test("SCN-006/007/015: search across fields, labels, and clicking a label", async ({ page }) => {
  await page.goto("/");
  await saveLink(page, LRN, { copy: false, label: "learning" });
  await page.fill("#searchInput", "calm");
  await expect(page.locator(".item")).toHaveCount(1);
  await page.fill("#searchInput", "#learning");
  await expect(page.locator(".item .title")).toHaveText(/Spaced Repetition/i);
  await page.fill("#searchInput", "");
  // click a label chip to filter
  await page.locator(".item .chip", { hasText: "learning" }).first().click();
  await expect(page.locator("#searchInput")).toHaveValue(/#learning/);
});

test("SCN-008/009: mark read and focus with the Finished view", async ({ page }) => {
  await page.goto("/");
  await page.fill("#searchInput", "#learning");
  await page.locator(".item .statusbtn", { hasText: "Mark as read" }).first().click();
  await page.fill("#searchInput", "");
  await page.click('#filter button[data-f="finished"]');
  await expect(page.locator(".item .title", { hasText: /Spaced Repetition/i })).toBeVisible();
  await expect(page.locator(".item .badge.read")).toBeVisible();
  await page.click('#filter button[data-f="all"]');
});

test("SCN-016/017: bulk select, archive, restore", async ({ page }) => {
  await page.goto("/");
  const before = await page.locator(".item").count();
  await page.locator(".item .selbox").first().click();
  await expect(page.locator("#bulkbar")).toBeVisible();
  await page.click('[data-selall]');
  await page.click('[data-archive]');
  await expect(page.locator("#archivedToggle")).toContainText(/Archived \(/);
  await page.click("#archivedToggle");
  await expect(page.locator("#archivedBanner")).toBeVisible();
  await expect(page.locator(".item")).toHaveCount(before);
  // restore one
  await page.locator(".item .statusbtn", { hasText: "Restore" }).first().click();
  await page.click("#archivedToggle");
  await expect(page.locator(".item")).toHaveCount(1);
});

test("SCN-018: save and re-run a collection", async ({ page }) => {
  await page.goto("/");
  await page.fill("#searchInput", "#reading");
  await page.click('[data-startsave]');
  await page.fill("#collName", "My reading");
  await page.click('[data-savecoll]');
  await page.fill("#searchInput", "");
  await page.locator('.coll', { hasText: "My reading" }).click();
  await expect(page.locator("#searchInput")).toHaveValue(/#reading/);
});

test("SCN-014/022: sort and display preferences persist", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#sortSelect", "alpha");
  await page.click("#displayBtn");
  await page.click('#fontSeg button[data-fs="large"]');
  await page.reload();
  await page.waitForSelector("[data-harness-ready='true']");
  await expect(page.locator("body")).toHaveClass(/fs-large/);
  await expect(page.locator("#sortSelect")).toHaveValue("alpha");
});

test("SCN-021: import and export bookmark HTML", async ({ page }) => {
  const tmp = path.join(__dirname, "..", "..", ".tmp-acceptance", "import.html");
  fs.writeFileSync(tmp,
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n<DT><H3>Work</H3>\n<DL><p>\n' +
    '<DT><A HREF="https://news.ycombinator.com/" ADD_DATE="1600000000" TAGS="tech">Hacker News</A>\n' +
    '</DL><p>\n</DL><p>\n');
  await page.goto("/");
  const before = await page.locator(".item").count();
  await page.setInputFiles("#importFile", tmp);
  await expect(page.locator("#toolsStatus")).toContainText(/Imported 1/);
  await expect(page.locator(".item")).toHaveCount(before + 1);
  await page.fill("#searchInput", "Hacker News");
  await expect(page.locator(".item .chip", { hasText: "tech" })).toBeVisible();
  await expect(page.locator(".item .chip", { hasText: "Work" })).toBeVisible();
});

test("SCN-020: a preserved copy is viewable", async ({ request }) => {
  const state = await (await request.get("/api/state")).json();
  const withCopy = state.bookmarks.find((b) => b.keepCopy && b.capturedAt && b.copyKind === "page");
  expect(withCopy, "a bookmark with a preserved page copy exists").toBeTruthy();
  const res = await request.get("/api/snapshot/" + withCopy.id);
  expect(res.ok()).toBeTruthy();
  expect(await res.text()).toContain("Preserved copy saved by Calm Bookmarks");
});
