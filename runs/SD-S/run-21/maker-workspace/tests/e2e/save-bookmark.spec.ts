import { test, expect } from "@playwright/test";
test("gathers page details, saves, edits, and persists", async ({ page }) => {
  const token = Date.now();
  await page.route("**/api/metadata/preview", (r) =>
    r.fulfill({
      json: {
        requestedUrl: `https://example.com/${token}`,
        finalUrl: `https://example.com/${token}`,
        title: `Gathered ${token}`,
        description: "A gathered description",
        siteIconUrl: null,
        previewImageUrl: null,
        warnings: ["missing_icon", "missing_image"]
      }
    })
  );
  await page.goto("/");
  await page.getByRole("button", { name: /add bookmark/i }).click();
  await page.getByLabel("Paste a link").fill(`https://example.com/${token}`);
  await page.getByRole("button", { name: "Gather details" }).click();
  await expect(page.locator(`input[value="Gathered ${token}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await expect(
    page.getByText(`Gathered ${token}`, { exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(`Gathered ${token}`, { exact: true })
  ).toBeVisible();
});
