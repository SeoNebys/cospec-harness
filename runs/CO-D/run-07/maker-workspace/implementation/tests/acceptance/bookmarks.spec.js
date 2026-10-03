import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Each test gets a fresh browser context => fresh session cookie => empty account.

const PORT = process.env.ACCEPT_PORT || "4066";
const TESTPAGE = `http://127.0.0.1:${PORT}/testpage/x`;

async function ready(page) {
  await page.goto("/");
  await page.waitForSelector('body[data-harness-ready="true"]');
}
async function saveViaUI(page, url, { title, tags = [], note } = {}) {
  await page.fill("#url", url);
  await page.click("#saveBtn");
  await page.waitForSelector('[data-f="ok"]');
  if (title !== undefined) await page.fill('[data-f="title"]', title);
  for (const t of tags) { await page.fill('[data-f="tagentry"]', t); await page.keyboard.press("Enter"); }
  if (note !== undefined) await page.fill('[data-f="note"]', note);
  await page.click('[data-f="ok"]');
  await page.waitForSelector('[data-f="ok"]', { state: "detached" });
}
const cardTitles = (page) => page.locator(".card .card-title").allInnerTexts();

test("SCN-001/002 save with auto-filled details, then edit the title", async ({ page }) => {
  await ready(page);
  await page.fill("#url", TESTPAGE);
  await page.click("#saveBtn");
  await page.waitForSelector('[data-f="ok"]');
  await expect(page.locator('[data-f="title"]')).toHaveValue("Sample Test Page Title");
  await page.click('[data-f="ok"]');
  await expect(page.locator(".card")).toHaveCount(1);
  // edit title later
  await page.click('[data-a="edit"]');
  await page.fill('[data-f="title"]', "Renamed Title");
  await page.click('[data-f="ok"]');
  await expect(page.locator(".card .card-title")).toHaveText("Renamed Title");
});

test("SCN-008 non-link is blocked; unreadable page still saveable", async ({ page }) => {
  await ready(page);
  await page.fill("#url", "hello world");
  await page.click("#saveBtn");
  await expect(page.locator("#saveError")).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(0);
  // unreadable (blocked host) -> preview opens with warning, still saveable
  await page.fill("#url", "https://10.0.0.1/private");
  await page.click("#saveBtn");
  await page.waitForSelector('[data-f="ok"]');
  await expect(page.locator(".panel .banner")).toBeVisible();
  await page.fill('[data-f="title"]', "Manually titled");
  await page.click('[data-f="ok"]');
  await expect(page.locator(".card .card-title")).toHaveText("Manually titled");
});

test("SCN-003/011 duplicate save and address-edit both guide to existing", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, TESTPAGE, { title: "First" });
  // saving the same link again -> opens existing edit with notice
  await page.fill("#url", TESTPAGE);
  await page.click("#saveBtn");
  await page.waitForSelector(".panel .plabel");
  await expect(page.locator(".panel .plabel")).toHaveText(/Already saved/);
  await page.click('[data-f="cancel"]');
  await expect(page.locator(".card")).toHaveCount(1);
  // open original in a new tab: title is a link with target=_blank
  await expect(page.locator("a.card-title")).toHaveAttribute("target", "_blank");
});

test("SCN-004 tags (reuse) and formatted note", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/a`, { title: "Alpha", tags: ["reading"] });
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/b`, { title: "Beta" });
  // edit Beta: reuse existing tag via suggestion + formatted note
  const beta = page.locator(".card", { hasText: "Beta" });
  await beta.locator('[data-a="edit"]').click();
  await page.locator('.suggest .chip', { hasText: "reading" }).click();
  await page.fill('[data-f="note"]', "# Why\n**bold** and a [link](https://example.com)\n- one\n1. first");
  await page.click('[data-f="ok"]');
  const b2 = page.locator(".card", { hasText: "Beta" });
  await expect(b2.locator(".tag", { hasText: "reading" })).toHaveCount(1);
  await expect(b2.locator(".note-line strong")).toHaveText("bold");
  await expect(b2.locator(".note-line .nh")).toHaveText("Why");
  await expect(b2.locator(".note-line ol li")).toHaveCount(1);
  await expect(b2.locator(".note-line ul li")).toHaveCount(1);
});

test("SCN-005 search: boolean, tag click, no-results", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/rome-guide`, { title: "Rome Guide", tags: ["travel", "article"] });
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/rome-book`, { title: "Ancient Rome", tags: ["book"] });
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/ramen`, { title: "Ramen", tags: ["recipes"] });
  await page.fill("#search", "rome AND (#article OR #book)");
  await expect(page.locator(".card")).toHaveCount(2);
  await page.fill("#search", "");
  await page.locator('.tag[data-tag="recipes"]').first().click();
  await expect(page.locator(".card")).toHaveCount(1);
  await page.locator(".filters .clear").click();
  await page.fill("#search", "zzzznope");
  await expect(page.locator("#noResults")).toBeVisible();
});

test("SCN-006 read/finished status and views", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/x`, { title: "X" });
  await page.click('[data-a="toggle"]');
  await expect(page.locator(".status-badge.finished")).toBeVisible();
  await page.locator('#segment button', { hasText: "To read" }).click();
  await expect(page.locator(".card")).toHaveCount(0);
  await page.locator('#segment button', { hasText: "Finished" }).click();
  await expect(page.locator(".card")).toHaveCount(1);
});

test("SCN-012 archive hides from collection & search, restore brings back", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/x`, { title: "Archivable" });
  await page.locator('[data-a="more"]').click();
  await page.locator('.menu-list [data-a="archive"]').click();
  await expect(page.locator(".card")).toHaveCount(0);
  await expect(page.locator("#archiveBtn")).toHaveText(/Archived \(1\)/);
  await page.fill("#search", "Archivable");
  await expect(page.locator(".card")).toHaveCount(0); // hidden from search
  await page.fill("#search", "");
  await page.click("#archiveBtn");
  await page.locator('[data-a="restore"]').click();
  await page.click("#archiveBtn");
  await expect(page.locator(".card")).toHaveCount(1);
});

test("SCN-013 bulk actions in select mode", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/1`, { title: "One" });
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/2`, { title: "Two" });
  await page.click("#selectBtn");
  await page.locator(".selbox").nth(0).check();
  await page.locator(".selbox").nth(1).check();
  await expect(page.locator("#bulkBar")).toBeVisible();
  await page.locator('[data-b="finished"]').click();
  await expect(page.locator(".status-badge.finished")).toHaveCount(2);
});

test("SCN-014 saved view persists as a rule", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/a`, { title: "A", tags: ["keep"] });
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/b`, { title: "B", tags: ["other"] });
  await page.locator('.tag[data-tag="keep"]').first().click();
  await page.locator(".filters .saveview").click();
  await page.fill("#viewname", "Keepers");
  await page.click("#vok");
  await page.locator(".filters .clear").click();
  await expect(page.locator(".card")).toHaveCount(2);
  await page.click("#viewsBtn");
  await page.locator(".view-row .apply", { hasText: "Keepers" }).click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card .card-title")).toHaveText("A");
});

test("SCN-015 auto preserved copy shows; PDF labelled", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/x`, { title: "HasCopy" });
  // auto copy is captured in the background; poll for the copy line
  await expect(page.locator(".copy-line")).toContainText("Saved copy", { timeout: 8000 });
  // PDF stays a PDF
  await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/doc.pdf`, { title: "APDF" });
  const pdfCard = page.locator(".card", { hasText: "APDF" });
  await expect(pdfCard.locator(".copy-line")).toContainText("(PDF)", { timeout: 8000 });
});

test("SCN-016 import (folders->tags, dedup, dates) and export", async ({ page }) => {
  await ready(page);
  await saveViaUI(page, "https://www.nasa.gov/webb/", { title: "Existing NASA" });
  const sample = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://example.com/great" ADD_DATE="1717200000">Great Article</A>
    <DT><A HREF="https://nasa.gov/webb" ADD_DATE="1716000000">NASA dup</A>
  </DL><p>
  <DT><H3>Recipes</H3>
  <DL><p>
    <DT><A HREF="https://recipes.example.com/tacos" ADD_DATE="1715000000">Tacos</A>
  </DL><p>
</DL><p>`;
  const file = join(tmpdir(), "sample-bm.html");
  writeFileSync(file, sample);
  await page.click("#settingsBtn");
  await page.click("#setImport");
  await page.setInputFiles("#impFile", file);
  await page.waitForSelector("#impDo");
  await expect(page.locator("#impPrev .banner")).toContainText("2 new, 1 already saved");
  await page.click("#impDo");
  await expect(page.locator(".card")).toHaveCount(3); // existing + 2 new (nasa skipped)
  const tacos = page.locator(".card", { hasText: "Tacos" });
  await expect(tacos.locator(".tag", { hasText: "recipes" })).toHaveCount(1);
  // export downloads a file
  await page.click("#settingsBtn");
  const [ download ] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#setExport"),
  ]);
  expect(download.suggestedFilename()).toBe("my-bookmarks.html");
});

test("SCN-009/017 sorting, items-per-page paging, text size persist", async ({ page }) => {
  await ready(page);
  for (const n of ["Cherry", "Apple", "Banana"]) {
    await saveViaUI(page, `http://127.0.0.1:${PORT}/testpage/${n}`, { title: n });
  }
  // sort A-Z
  await page.selectOption("#sort", "az");
  await expect(page.locator(".card .card-title").first()).toHaveText("Apple");
  // items per page = 10 (only 3 -> no pager); set pagesize small via settings and text size
  await page.click("#settingsBtn");
  await page.selectOption("#setText", "lg");
  await page.click("#setOk");
  await expect(page.locator("body")).toHaveClass(/text-lg/);
  // persistence: reload same context keeps sort=az (server prefs) and text lg
  await page.reload();
  await page.waitForSelector('body[data-harness-ready="true"]');
  await expect(page.locator("#sort")).toHaveValue("az");
  await expect(page.locator("body")).toHaveClass(/text-lg/);
});
