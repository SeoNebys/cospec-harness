import { test, expect } from "@playwright/test";
test("shows tags and toggles favorites", async ({ page, request }) => {
  const token = Date.now();
  await request.post("/api/bookmarks", {
    data: {
      url: `https://example.com/tag-${token}`,
      title: `Organize ${token}`,
      tags: ["Design", " design "]
    }
  });
  await page.goto("/");
  const card = page
    .getByRole("article")
    .filter({ hasText: `Organize ${token}` });
  await expect(card.getByText("#Design")).toHaveCount(1);
  await card.getByRole("button", { name: "Add favorite" }).click();
  await page.goto("/favorites");
  await expect(
    page.getByText(`Organize ${token}`, { exact: true })
  ).toBeVisible();
});
