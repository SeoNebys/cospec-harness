// Gherkin-based acceptance tests (SCN-001..009), driven through a real browser
// against the running application.

import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadChromium, startServer } from "./helper.js";

const chromium = loadChromium();
let browser;
let srv;
let page;

before(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
});
after(async () => {
  if (browser) await browser.close();
});
beforeEach(async () => {
  srv = await startServer();
  const ctx = await browser.newContext();
  page = await ctx.newPage();
});
afterEach(async () => {
  await page.context().close();
  await srv.close();
});

async function open() {
  await page.goto(srv.base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('body[data-harness-ready="true"]');
}
async function save(url) {
  await page.fill("#url", url);
  await page.click("#saveBtn");
}
async function firstCard() {
  await page.waitForSelector("li.link");
  return page.locator("li.link").first();
}

test("SCN-009: first run shows a ready, guiding empty state", async () => {
  await open();
  await assert.doesNotReject(page.waitForSelector(".empty"));
  assert.match(await page.textContent(".empty"), /No links saved yet/i);
  assert.ok(await page.isVisible("#url"));
});

test("SCN-001: saving a link auto-fills its title and description", async () => {
  await open();
  await save("example.com/how-to-cook-rice");
  const card = await firstCard();
  await card.locator(".title a").waitFor();
  assert.match(await card.locator(".title a").textContent(), /How To Cook Rice/);
  assert.match(await card.locator(".desc").textContent(), /Auto description/);
  assert.equal(await card.locator(".taginput").count(), 1); // tag area present
});

test("SCN-008: duplicate save is not copied and jumps to the existing link", async () => {
  await open();
  await save("https://example.com/a");
  await firstCard();
  await save("https://example.com/a/"); // trailing slash duplicate
  await page.waitForSelector(".savemsg.dup");
  assert.match(await page.textContent(".savemsg.dup"), /already saved/i);
  assert.equal(await page.locator("li.link").count(), 1);
});

test("SCN-008: non-link text is rejected with a message and preserved", async () => {
  await open();
  await save("dinner ideas");
  await page.waitForSelector(".savemsg.err");
  assert.match(await page.textContent(".savemsg.err"), /web address/i);
  assert.equal(await page.inputValue("#url"), "dinner ideas"); // preserved
  assert.equal(await page.locator("li.link").count(), 0);
});

test("SCN-002: add tags one at a time (deduped) and remove one", async () => {
  await open();
  await save("example.com/tagme");
  const card = await firstCard();
  const input = card.locator(".taginput");
  await input.fill("reading"); await input.press("Enter");
  await input.fill("Reading"); await input.press("Enter"); // duplicate (case) ignored
  await input.fill("ai"); await input.press("Enter");
  await assert.doesNotReject(card.locator(".tag", { hasText: "reading" }).first().waitFor());
  assert.equal(await card.locator(".tag").count(), 2);
  // remove "ai"
  await card.locator(".tag", { hasText: "ai" }).locator(".x").click();
  await page.waitForFunction(() => document.querySelectorAll("li.link .tag").length === 1);
  assert.equal(await card.locator(".tag").count(), 1);
});

test("SCN-004: add, edit and clear a note", async () => {
  await open();
  await save("example.com/noteme");
  const card = await firstCard();
  await card.locator(".miniadd", { hasText: "Add a note" }).click();
  await card.locator(".noteedit textarea").fill("the one Mara sent me");
  await card.locator(".act.primary", { hasText: "Save note" }).click();
  await card.locator(".note").waitFor();
  assert.match(await card.locator(".note").textContent(), /Mara/);
  // edit -> clear
  await card.locator(".note").click();
  await card.locator(".noteedit textarea").fill("");
  await card.locator(".act.primary", { hasText: "Save note" }).click();
  await card.locator(".miniadd", { hasText: "Add a note" }).waitFor();
});

test("SCN-003: reading list is opt-in and Done keeps the link saved", async () => {
  await open();
  await save("example.com/readme");
  let card = await firstCard();
  // not in list by default
  assert.equal(await card.locator(".statepill", { hasText: "In reading list" }).count(), 0);
  await card.locator(".act", { hasText: "Reading list" }).click();
  await card.locator(".statepill", { hasText: "In reading list" }).waitFor();
  // reading list view shows it
  await page.locator(".views button", { hasText: "Reading list" }).click();
  assert.equal(await page.locator("li.link").count(), 1);
  // Done removes from list but keeps it in All
  await page.locator("li.link").first().locator(".act.primary", { hasText: "Done" }).click();
  await page.waitForFunction(() => document.querySelectorAll("li.link").length === 0);
  await page.locator(".views button", { hasText: "All links" }).click();
  assert.equal(await page.locator("li.link").count(), 1);
});

test("SCN-005: search across fields, tag filter, combine, and no-results", async () => {
  await open();
  await save("seriouseats.com/best-pasta");
  await firstCard();
  await save("investopedia.com/index-funds");
  await page.waitForFunction(() => document.querySelectorAll("li.link").length === 2);
  // tag the pasta one and note it
  const pasta = page.locator("li.link", { hasText: "Best Pasta" });
  await pasta.locator(".taginput").fill("recipes");
  await pasta.locator(".taginput").press("Enter");
  await pasta.locator(".tag", { hasText: "recipes" }).waitFor();

  // search by title fragment
  await page.fill("#search", "pasta");
  await page.waitForFunction(() => document.querySelectorAll("li.link").length === 1);
  assert.match(await page.locator("li.link").first().textContent(), /Best Pasta/);
  assert.ok(await page.locator("li.link mark").count() > 0); // highlighted

  // search by address fragment
  await page.fill("#search", "investopedia");
  await page.waitForFunction(() => {
    const c = document.querySelectorAll("li.link");
    return c.length === 1 && /Index Funds/.test(c[0].textContent);
  });

  // clear, then filter by tag click
  await page.click("#clr");
  await page.locator("li.link", { hasText: "Best Pasta" }).locator(".tag", { hasText: "recipes" }).locator("span").first().click();
  await page.waitForSelector(".filters .fchip");
  await page.waitForFunction(() => document.querySelectorAll("li.link").length === 1);

  // combine tag filter + search that excludes -> no results
  await page.fill("#search", "zzz");
  await page.waitForSelector(".empty");
  assert.match(await page.textContent(".empty"), /No links match/i);
});

test("SCN-006: page details fail to load — still saved, user adds title & description", async () => {
  await open();
  await save("https://private.example.com/report?id=8842");
  const card = await firstCard();
  await card.locator(".warn").waitFor();
  assert.match(await card.locator(".warn").textContent(), /Couldn't load/i);
  // title falls back to the address
  assert.match(await card.locator(".title a").textContent(), /private\.example\.com/);
  // add a title manually
  await card.locator(".miniadd", { hasText: "Add a title yourself" }).click();
  await card.locator(".linkfield input").fill("Quarterly Report");
  await card.locator(".act.primary", { hasText: "Save" }).click();
  await page.waitForFunction(() => /Quarterly Report/.test(document.querySelector("li.link .title a")?.textContent || ""));
  // add an optional description
  await card.locator(".miniadd", { hasText: "Add a description" }).click();
  await card.locator(".linkfield input").fill("Internal Q3 numbers");
  await card.locator(".act.primary", { hasText: "Save" }).click();
  await card.locator(".desc").waitFor();
  assert.match(await card.locator(".desc").textContent(), /Internal Q3 numbers/);
  // searchable by the manual title
  await page.fill("#search", "quarterly");
  await page.waitForFunction(() => document.querySelectorAll("li.link").length === 1);
});

test("SCN-007: removing asks for confirmation, then deletes permanently", async () => {
  await open();
  await save("example.com/deleteme");
  let card = await firstCard();
  await card.locator(".removelink", { hasText: "Remove" }).click();
  await card.locator(".confirmdel").waitFor();
  // cancel keeps it
  await card.locator(".confirmdel button", { hasText: "Cancel" }).click();
  assert.equal(await page.locator("li.link").count(), 1);
  // confirm removes it
  await card.locator(".removelink", { hasText: "Remove" }).click();
  await card.locator(".confirmdel .yes", { hasText: "Remove" }).click();
  await page.waitForSelector(".empty");
  assert.equal(await page.locator("li.link").count(), 0);
  // gone after reload (persisted)
  await open();
  assert.equal(await page.locator("li.link").count(), 0);
});
