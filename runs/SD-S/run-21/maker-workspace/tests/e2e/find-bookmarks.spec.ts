import { test, expect } from "@playwright/test";
test("searches and clears discovery criteria", async ({ page, request }) => {
  const token = Date.now();
  await request.post("/api/bookmarks", {
    data: {
      url: `https://example.com/find-${token}`,
      title: `Needle ${token}`,
      description: "unique discovery phrase"
    }
  });
  await page.goto("/");
  await page.getByLabel("Search bookmarks").fill("unique discovery phrase");
  await expect(
    page.getByText(`Needle ${token}`, { exact: true })
  ).toBeVisible();
  await page.getByLabel("Search bookmarks").fill("not-present-anywhere");
  await expect(page.getByText("Nothing matches just yet")).toBeVisible();
  await page.getByLabel("Clear search").click();
  await expect(
    page.getByText(`Needle ${token}`, { exact: true })
  ).toBeVisible();
});
