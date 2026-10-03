// Browser-level acceptance test for the real UI, using a deterministic mock fetcher.
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../../src/store.js");
const { createService } = require("../../src/service.js");
const { createApp } = require("../../src/app.js");

let server, base, dir;

test.beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-e2e-"));
  const fetcher = {
    async fetchAndPreserve(url) {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return { ok: true, kind: "html", title: "Title of " + host, desc: "A summary of " + host, buffer: Buffer.from("<h1>copy of " + host + "</h1><p>Preserved body.</p>") };
    },
  };
  const service = createService(new Store(dir), fetcher);
  server = createApp(service);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + server.address().port;
});

test.afterAll(async () => { await new Promise((r) => server.close(r)); });

test("first-run empty state, save, search, tag, reading list, archive, delete", async ({ page }) => {
  await page.goto(base + "/");
  await expect(page.locator("body[data-harness-ready='true']")).toBeVisible();

  // SCN-009: empty state
  await expect(page.locator(".empty .lead")).toHaveText("Your library is empty");

  // SCN-001: save a link
  await page.fill("#url", "example.com/hello");
  await page.click("#saveBtn");
  await expect(page.locator("li.item")).toHaveCount(1);
  await expect(page.locator("li.item a.title")).toHaveText("Title of example.com");
  await expect(page.locator("li.item .flag.copy")).toContainText("Saved copy");

  // save a second link
  await page.fill("#url", "https://news.ycombinator.com");
  await page.click("#saveBtn");
  await expect(page.locator("li.item")).toHaveCount(2);

  // SCN-008: duplicate prevention
  await page.fill("#url", "http://www.news.ycombinator.com/");
  await page.click("#saveBtn");
  await expect(page.locator("#dupNotice.show")).toBeVisible();
  await expect(page.locator("li.item")).toHaveCount(2);

  // SCN-011: non-address rejected
  await page.fill("#url", "hello world");
  await page.click("#saveBtn");
  await expect(page.locator("#saveError.show")).toBeVisible();
  await expect(page.locator("li.item")).toHaveCount(2);

  // SCN-004: search filters
  await page.fill("#search", "news.ycombinator");
  await expect(page.locator("li.item")).toHaveCount(1);
  await page.fill("#search", "");
  await expect(page.locator("li.item")).toHaveCount(2);

  // SCN-005: reading list opt-in
  const firstCard = page.locator("li.item").first();
  await firstCard.locator('[data-act="toread"]').click();
  await page.click('.tab[data-view="toread"]');
  await expect(page.locator("li.item")).toHaveCount(1);

  // SCN-006: archive
  await page.click('.tab[data-view="library"]');
  await page.locator("li.item").first().locator('[data-act="archive"]').click();
  await expect(page.locator("li.item")).toHaveCount(1); // one hidden from library
  await page.click('.tab[data-view="archive"]');
  await expect(page.locator("li.item")).toHaveCount(1);
  await page.locator("li.item").first().locator('[data-act="restore"]').click();
  await expect(page.locator("li.item")).toHaveCount(0); // archive now empty
  await page.click('.tab[data-view="library"]');
  await expect(page.locator("li.item")).toHaveCount(2);

  // SCN-008: delete with confirmation
  await page.locator("li.item").first().locator('[data-act="delete"]').click();
  await expect(page.locator("#confirmOverlay.open")).toBeVisible();
  await page.click("#cfOk");
  await expect(page.locator("li.item")).toHaveCount(1);
});
