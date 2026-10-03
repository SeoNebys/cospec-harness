import { expect, test } from "@playwright/test";

test("search, no-results recovery, and sort controls update the collection", async ({ page, request }) => {
  const suffix = Date.now().toString(36);
  const created: string[] = [];
  for (const title of [`Zebra ${suffix}`, `Apple ${suffix}`]) {
    const response = await request.post("/api/bookmarks", { data: {
      url: `https://example.test/${title.split(" ")[0].toLowerCase()}-${suffix}`,
      title, titleOrigin: "user", note: `needle-${suffix}`, tags: [], iconToken: null
    } });
    expect(response.ok()).toBeTruthy();
    created.push((await response.json()).id);
  }
  try {
    await page.goto("/");
    await page.getByLabel("Search your library").fill(`needle-${suffix}`);
    await expect(page.getByRole("link", { name: new RegExp(`Zebra ${suffix}`) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`Apple ${suffix}`) })).toBeVisible();
    await page.getByLabel("Sort by").selectOption("alphabetical");
    const titles = page.locator(".bookmark-title");
    await expect(titles.first()).toContainText("Apple");
    await page.getByLabel("Search your library").fill(`missing-${suffix}`);
    await expect(page.getByRole("heading", { name: "No bookmarks match" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByLabel("Search your library")).toHaveValue("");
  } finally {
    for (const id of created) await request.delete(`/api/bookmarks/${id}`);
  }
});
