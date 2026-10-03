import { expect } from "@playwright/test";

export const FIX = (name) => `http://127.0.0.1:4100/__fixtures/${name}`;

export async function resetAndOpen(page, request) {
  await request.post("/api/__test/reset");
  await page.goto("/");
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();
}

// Seed a bookmark directly via the API (for test setup, not the behaviour under test).
export async function seed(request, fields) {
  const res = await request.post("/api/bookmarks", { data: fields });
  return (await res.json()).bookmark;
}

// Drive the real "save a link" flow through the UI.
export async function saveViaUI(page, url, { tags = "", note = "", expectUnreadable = false } = {}) {
  await page.fill("#url", url);
  await page.click("#fetchBtn");
  if (expectUnreadable) {
    await expect(page.locator("#fetchNote.error")).toBeVisible();
  } else {
    await expect(page.locator("#title")).not.toHaveValue("");
  }
  if (tags) await page.fill("#tags", tags);
  if (note) await page.fill("#note", note);
  await page.click("#saveBtn");
}

export function cardByTitle(page, text) {
  return page.locator("li.bm-item", { hasText: text });
}
