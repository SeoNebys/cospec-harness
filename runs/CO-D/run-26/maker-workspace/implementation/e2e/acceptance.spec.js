// Gherkin-based acceptance tests exercised through the real UI + server.
import { test, expect } from "@playwright/test";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const SEED = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://css-tricks.com/flexbox" ADD_DATE="1600000300" TAGS="css,layout,reference">A Complete Guide to Flexbox</A>
  <DD>Great flexbox reference.
  <DT><A HREF="https://stripe.com" ADD_DATE="1600000200" TAGS="payments,api,reference">Stripe</A>
  <DT><A HREF="https://atlasobscura.com/rome" ADD_DATE="1600000100" TAGS="travel,article,history">A Walking Tour of Ancient Rome</A>
  <DT><A HREF="https://gutenberg.org/731" ADD_DATE="1600000000" TAGS="history,book">Decline and Fall of the Roman Empire</A>
  <DD>The classic account of the fall of Rome.
  <DT><H3>Archived</H3>
  <DL><p>
    <DT><A HREF="https://old.example.com/legacy" ADD_DATE="1500000000" TAGS="old">Legacy Page</A>
  </DL><p>
</DL><p>`;

let seedPath;
test.beforeAll(() => {
  seedPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bm-seed-")), "seed.html");
  fs.writeFileSync(seedPath, SEED);
});

test.describe.configure({ mode: "serial" });

async function ready(page) { await page.waitForSelector("[data-harness-ready='true']"); }

test("SCN-010 empty collection shows an invitation", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await expect(page.locator(".empty .big")).toHaveText(/Nothing saved yet/);
});

test("SCN-017 import populates, preserving tags/dates and archived status", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await page.locator("#settingsBtn").click();
  await page.locator("#importFile").setInputFiles(seedPath);
  await expect(page.locator("#ioMsg")).toContainText(/Imported 5/);
  await page.locator("#settingsClose").click();
  // 4 active shown in All; archived excluded
  await expect(page.locator(".card")).toHaveCount(4);
  await expect(page.locator(".vtab", { hasText: "Archived" })).toContainText("1");
});

test("SCN-004 search query language", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await page.locator("#search").fill("#reference");
  await expect(page.locator(".card")).toHaveCount(2);
  await page.locator("#search").fill('"fall of rome"');
  await expect(page.locator(".card")).toHaveCount(1);
  await page.locator("#search").fill("rome (#article OR #book)");
  await expect(page.locator(".card")).toHaveCount(2);
  await page.locator("#search").fill("rome (#article OR #book");
  await expect(page.locator(".empty.error .big")).toContainText(/parenthesis/);
  await page.locator("#clearSearch").click();
  await expect(page.locator(".card")).toHaveCount(4);
});

test("SCN-005 browse by tag combines with search", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await page.locator("#search").fill("rome");
  await expect(page.locator(".card")).toHaveCount(2);
  await page.locator(".tagbtn", { hasText: "#book" }).first().click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator("#browseBanner")).toContainText("#book");
});

test("SCN-006 read-later view and mark as read", async ({ page }) => {
  await page.goto("/"); await ready(page);
  const first = page.locator(".card").first();
  await first.locator("button[data-act='later']").click();
  await page.locator(".vtab", { hasText: "Read later" }).click();
  await expect(page.locator(".card")).toHaveCount(1);
  await page.locator(".card").first().locator("button[data-act='read']").click();
  await expect(page.locator(".empty .big")).toContainText(/caught up/);
  await page.locator(".vtab", { hasText: "All bookmarks" }).click();
  await expect(page.locator(".card")).toHaveCount(4); // nothing lost
});

test("SCN-012/013 bulk select-all-matching then archive", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await page.locator("#search").fill("#reference");
  await page.locator(".selbox").first().check();
  await page.locator("button[data-bulk='all']").click();
  await expect(page.locator(".bulkbar .bulk-count")).toContainText("2 selected");
  await page.locator("button[data-bulk='archive']").click();
  await page.locator("#clearSearch").click();
  await expect(page.locator(".card")).toHaveCount(2); // 4 - 2 archived
  await page.locator(".vtab", { hasText: "Archived" }).click();
  await expect(page.locator(".card")).toHaveCount(3); // 1 seed + 2 just archived
});

test("SCN-007/018 sort and per-page persist via settings", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await page.locator("#settingsBtn").click();
  await page.locator("#setSort").selectOption("title-az");
  await page.locator("#setPageSize").selectOption("10");
  await page.locator("#setTextSize .seg", { hasText: "Large" }).click();
  await page.locator("#settingsClose").click();
  await page.reload(); await ready(page);
  await expect(page.locator("#sortSelect")).toHaveValue("title-az");
  await expect(page.locator("body")).toHaveClass(/text-lg/);
});

test("SCN-016 saved filter with include/exclude applies within a view", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await page.locator("#search").fill("#reference");
  await page.locator("button[data-save='start']").click();
  await page.locator("#filterName").fill("Refs no API");
  await page.locator("#filterInc").fill("reference");
  await page.locator("#filterExc").fill("api");
  await page.locator("button[data-save='confirm']").click();
  await page.locator("#clearSearch").click();
  await page.locator(".savedapply", { hasText: "Refs no API" }).click();
  await expect(page.locator("#browseBanner")).toContainText("excluding");
});

test("SCN-014 manual save renders a formatted note; SCN-011 delete with confirm", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await page.locator("#url").fill("https://manual-entry.example.test/thing");
  await page.locator("#fetchBtn").click();
  await page.waitForSelector("#details:not([hidden])");
  await page.locator("#title").fill("Manual note demo");
  await page.locator("#note").fill("**bold** and\n- one\n- two");
  await page.locator("#saveBtn").click();
  const card = page.locator(".card", { hasText: "Manual note demo" });
  await expect(card.locator(".note-body strong")).toHaveText("bold");
  await expect(card.locator(".note-body li")).toHaveCount(2);
  // delete with confirmation
  await card.locator("button[data-act='menu']").click();
  await card.locator("button[data-act='del-ask']").click();
  await card.locator("button[data-act='del-yes']").click();
  await expect(page.locator(".card", { hasText: "Manual note demo" })).toHaveCount(0);
});
