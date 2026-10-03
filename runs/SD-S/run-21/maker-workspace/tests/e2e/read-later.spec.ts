import { test, expect } from "@playwright/test";
test("to-read membership changes without losing favorite", async ({
  page,
  request
}) => {
  const token = Date.now();
  const r = await request.post("/api/bookmarks", {
    data: {
      url: `https://example.com/read-${token}`,
      title: `Read ${token}`,
      favorite: true
    }
  });
  expect(r.ok()).toBeTruthy();
  await page.goto("/to-read");
  const card = page.getByRole("article").filter({ hasText: `Read ${token}` });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /to read/i }).click();
  await expect(card).toBeHidden();
  await page.goto("/favorites");
  await expect(page.getByText(`Read ${token}`, { exact: true })).toBeVisible();
});
