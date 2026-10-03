import { test, expect } from "@playwright/test";

// Gherkin-based acceptance tests. Each maps to approved scenarios SCN-001..007.

async function reset(page) {
  await page.request.post("/api/__reset");
}
async function saveBookmark(page, url, { title, note, tags = [] } = {}) {
  await page.fill("#url", url);
  await page.click("#fetchBtn");
  await expect(page.locator("#editor")).toBeVisible();
  if (title !== undefined) await page.fill("#title", title);
  if (note !== undefined) await page.fill("#note", note);
  for (const t of tags) {
    await page.fill("#tagInput", t);
    await page.press("#tagInput", "Enter");
  }
  await page.click("#saveBtn");
  await expect(page.locator("#editor")).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await reset(page);
  await page.goto("/");
  await page.waitForSelector('[data-harness-ready="true"]');
});

// SCN-001 + SCN-002
test("SCN-001/002: save a link with auto-filled details, tags, note; then find it", async ({ page }) => {
  await page.fill("#url", "https://figma.com");
  await page.click("#fetchBtn");
  await expect(page.locator("#title")).toHaveValue(/Title of figma\.com/);
  await page.fill("#title", "Figma");
  await page.fill("#note", "design tool I use");
  await page.fill("#tagInput", "design");
  await page.press("#tagInput", "Enter");
  await page.click("#saveBtn");

  const item = page.locator(".item").first();
  await expect(item.locator(".title")).toContainText("Figma");
  await expect(item.locator(".note")).toContainText("design tool I use");
  await expect(item.locator(".itemtags")).toContainText("design");

  // find by a word from the note (SCN-002)
  await page.fill("#search", "design tool");
  await expect(page.locator(".item")).toHaveCount(1);
  // find by tag chip
  await page.fill("#search", "");
  await page.click('#filterChips .chip:has-text("design")');
  await expect(page.locator(".item")).toHaveCount(1);
});

// SCN-002 + SCN-005: no results message
test("SCN-005: search with no matches shows a no-results message", async ({ page }) => {
  await saveBookmark(page, "https://example.com", { title: "Example" });
  await page.fill("#search", "zzznotfound");
  await expect(page.locator(".empty")).toContainText("No bookmarks match your search");
});

// SCN-005: first-run empty state
test("SCN-005: first-run empty state invites saving the first link", async ({ page }) => {
  await expect(page.locator(".empty")).toContainText("No bookmarks yet");
  await page.click('.tab[data-view="later"]');
  await expect(page.locator(".empty")).toContainText("read-later list");
  await page.click('.tab[data-view="archive"]');
  await expect(page.locator(".empty")).toContainText("archive is empty");
});

// SCN-003: read-later reversible + separate view
test("SCN-003: read-later is reversible and shown in its own view", async ({ page }) => {
  await saveBookmark(page, "https://a.com", { title: "Alpha" });
  await page.click('.item:has-text("Alpha") button:has-text("Read later")');
  await expect(page.locator('.item:has-text("Alpha") .badge')).toContainText("Read later");
  await page.click('.tab[data-view="later"]');
  await expect(page.locator(".item")).toHaveCount(1);
  // unmark
  await page.click('.item:has-text("Alpha") button:has-text("In read later")');
  await expect(page.locator(".item")).toHaveCount(0);
  await page.click('.tab[data-view="all"]');
  await expect(page.locator('.item:has-text("Alpha") .badge')).toHaveCount(0);
});

// SCN-004: archive removes from everyday views, searchable + restorable
test("SCN-004: archive hides from All, stays searchable in Archive, restorable", async ({ page }) => {
  await saveBookmark(page, "https://b.com", { title: "Beta" });
  await page.click('.item:has-text("Beta") button:has-text("Archive")');
  await expect(page.locator(".item")).toHaveCount(0); // gone from All
  await page.click('.tab[data-view="archive"]');
  await expect(page.locator(".item")).toHaveCount(1);
  await page.fill("#search", "beta"); // searchable in archive
  await expect(page.locator(".item")).toHaveCount(1);
  await page.click('.item:has-text("Beta") button:has-text("Restore")');
  await expect(page.locator(".item")).toHaveCount(0); // gone from Archive
  await page.click('.tab[data-view="all"]');
  await expect(page.locator('.item:has-text("Beta")')).toHaveCount(1);
});

// SCN-006: failed auto-fill still saveable; invalid refused
test("SCN-006: failed auto-fill lets user save; invalid link refused", async ({ page }) => {
  await page.fill("#url", "https://no-details.example.com/x");
  await page.click("#fetchBtn");
  await expect(page.locator("#failBanner")).toBeVisible();
  await page.click("#saveBtn"); // save with no typed title -> URL as title
  await expect(page.locator(".item").first().locator(".title")).toContainText("no-details.example.com");

  // invalid link refused
  await page.fill("#url", "not a url");
  await page.click("#fetchBtn");
  await expect(page.locator("#editor")).toBeHidden();
  await expect(page.locator("#toast")).toContainText("valid link");
});

// SCN-007: duplicate warning -> edit existing; edit anytime
test("SCN-007: duplicate is prevented and routes to editing the existing bookmark", async ({ page }) => {
  await saveBookmark(page, "https://dup.com", { title: "Original" });
  // try to save the same link again
  await page.fill("#url", "https://dup.com/");
  await page.click("#fetchBtn");
  await expect(page.locator("#dupWarn")).toBeVisible();
  await expect(page.locator("#dupMsg")).toContainText("already saved");
  await page.click("#dupEditBtn");
  await expect(page.locator("#editBanner")).toBeVisible();
  await page.fill("#title", "Renamed");
  await page.click("#saveBtn");
  await expect(page.locator(".item")).toHaveCount(1); // no copy
  await expect(page.locator(".item").first().locator(".title")).toContainText("Renamed");

  // edit anytime via list Edit button
  await page.click('.item:has-text("Renamed") button:has-text("Edit")');
  await page.fill("#note", "added later");
  await page.click("#saveBtn");
  await expect(page.locator(".item").first().locator(".note")).toContainText("added later");
});
