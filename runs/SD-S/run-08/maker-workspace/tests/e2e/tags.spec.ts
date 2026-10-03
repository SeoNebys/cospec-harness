import { expect, test } from "@playwright/test";

test("reusable tags filter bookmarks and can be cleared", async ({ page, request }) => {
  const suffix = Date.now().toString(36);
  const tag = `Topic-${suffix}`;
  const created: string[] = [];
  for (const name of [`Alpha ${suffix}`, `Beta ${suffix}`]) {
    const response = await request.post("/api/bookmarks", { data: {
      url: `https://example.test/${name.split(" ")[0].toLowerCase()}-${suffix}`,
      title: name, titleOrigin: "user", note: "tag test", tags: [tag], iconToken: null
    } });
    expect(response.ok()).toBeTruthy();
    created.push((await response.json()).id);
  }
  try {
    await page.goto("/");
    await page.getByLabel("Tag", { exact: true }).selectOption({ label: `${tag} (2)` });
    await expect(page.getByRole("link", { name: new RegExp(`Alpha ${suffix}`) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`Beta ${suffix}`) })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByLabel("Tag", { exact: true })).toHaveValue("");
  } finally {
    for (const id of created) await request.delete(`/api/bookmarks/${id}`);
  }
});
