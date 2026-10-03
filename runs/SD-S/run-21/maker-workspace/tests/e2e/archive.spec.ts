import { test, expect } from "@playwright/test";
test("archives and restores with details intact", async ({ page, request }) => {
  const token = Date.now();
  const made = await (
    await request.post("/api/bookmarks", {
      data: {
        url: `https://example.com/archive-${token}`,
        title: `Archive ${token}`,
        tags: ["keep"]
      }
    })
  ).json();
  await request.post(`/api/bookmarks/${made.id}/archive`);
  await page.goto("/archive");
  const card = page
    .getByRole("article")
    .filter({ hasText: `Archive ${token}` });
  await expect(card).toContainText("#keep");
  await card.getByRole("button", { name: "Restore" }).click();
  await expect(card).toBeHidden();
  await page.goto("/");
  await expect(
    page.getByText(`Archive ${token}`, { exact: true })
  ).toBeVisible();
});
