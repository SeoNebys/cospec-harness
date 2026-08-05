// E2E — User Story 4: import then export. Mirrors quickstart 10–11.

import { test, expect } from "@playwright/test";

const NETSCAPE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Cooking</H3>
  <DL><p>
    <DT><A HREF="https://import-e2e.example/curry" ADD_DATE="1500000000">Curry</A>
  </DL><p>
</DL><p>`;

test("import a browser file: item appears with its folder as a tag", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-import").click();
  await page
    .getByTestId("import-file")
    .setInputFiles({ name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(NETSCAPE) });
  await page.getByTestId("import-confirm").click();
  await expect(page.getByTestId("import-result")).toContainText("Imported 1");
  await page.getByText("Done").click();

  const item = page.getByTestId("bookmark-item").filter({ hasText: "import-e2e" });
  await expect(item).toBeVisible();
  await expect(item.getByTestId("bookmark-tags")).toContainText("cooking");
});

test("export dialog clearly distinguishes the two formats", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-export").click();
  await expect(page.getByTestId("export-json")).toBeVisible();
  await expect(page.getByTestId("export-html")).toBeVisible();
  await expect(page.getByTestId("export-dialog")).toContainText("Keeps everything");
  await expect(page.getByTestId("export-dialog")).toContainText("Some detail dropped");
});

test("backup download has JSON content", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("url-input").fill("https://export-e2e.example/x");
  await page.getByTestId("save-button").click();
  await page.getByTestId("open-export").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-json").click(),
  ]);
  expect(download.suggestedFilename()).toBe("bookmarks-backup.json");
});
