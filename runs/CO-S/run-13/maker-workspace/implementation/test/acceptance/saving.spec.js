import { test, expect } from "@playwright/test";
import { resetAndOpen, saveViaUI, FIX, cardByTitle } from "./helpers.js";

test.beforeEach(async ({ page, request }) => resetAndOpen(page, request));

test("SCN-001: auto-collect details, add tags & note, and save into the list", async ({ page }) => {
  await saveViaUI(page, FIX("article.html"), { tags: "reading, calm", note: "keep this" });

  // auto-collected block was shown with a preview image and site name
  const card = cardByTitle(page, "Designing a Calm Bookmark Manager");
  await expect(card).toBeVisible();
  await expect(card.locator(".site")).toContainText("Calm Reading");
  await expect(card.locator(".tag")).toHaveText(["reading", "calm"]);
  await expect(card.locator(".note")).toContainText("keep this");
  await expect(page.locator("#flash")).toContainText("Saved");
  // form cleared
  await expect(page.locator("#url")).toHaveValue("");
});

test("SCN-001: a page with no preview image shows a placeholder", async ({ page }) => {
  await page.fill("#url", FIX("no-preview.html"));
  await page.click("#fetchBtn");
  await expect(page.locator("#autoPreview .preview-none")).toContainText("No preview image");
});

test("SCN-010: a mistyped address is rejected and Save stays unavailable", async ({ page }) => {
  await page.fill("#url", "not a url");
  await page.click("#fetchBtn");
  await expect(page.locator("#fetchNote.error")).toContainText("doesn't look like a web address");
  await expect(page.locator("#saveBtn")).toBeDisabled();
});

test("SCN-010: an unreadable page still lets me save by typing a title", async ({ page }) => {
  await page.fill("#url", FIX("data.json")); // served as JSON -> not readable as a page
  await page.click("#fetchBtn");
  await expect(page.locator("#fetchNote.error")).toContainText("couldn't read this page's details");
  await expect(page.locator("#saveBtn")).toBeDisabled();
  await page.fill("#title", "Manually titled");
  await expect(page.locator("#saveBtn")).toBeEnabled();
  await page.click("#saveBtn");
  await expect(cardByTitle(page, "Manually titled")).toBeVisible();
});

test("SCN-010: an address without a scheme gets https:// added", async ({ page }) => {
  // Works offline: the server normalises and echoes back the address regardless
  // of whether the page could actually be fetched.
  await page.fill("#url", "example.com/story");
  await page.click("#fetchBtn");
  await expect(page.locator("#url")).toHaveValue("https://example.com/story");
});
