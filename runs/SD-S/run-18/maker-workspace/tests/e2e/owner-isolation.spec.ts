import { expect, test, type BrowserContext } from "@playwright/test";

async function signIn(context: BrowserContext, email: string, password: string) {
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  return page;
}

test("owners cannot list, update, or delete each other's bookmarks", async ({ browser, request }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  await signIn(aliceContext, "alice@example.test", "Bookmarks-Alice-2026!");
  await signIn(bobContext, "bob@example.test", "Bookmarks-Bob-2026!");
  const url = `https://example.invalid/private-${Date.now()}`;
  const created = await aliceContext.request.post("/api/bookmarks", { data: { url, title: "Alice private", description: null, tags: ["Secret"] } });
  expect(created.status()).toBe(201);
  const bookmark = await created.json() as { id: string };
  const bobList = await bobContext.request.get("/api/bookmarks?query=Alice%20private");
  expect(bobList.status()).toBe(200);
  expect((await bobList.json()).items).toHaveLength(0);
  expect((await bobContext.request.patch(`/api/bookmarks/${bookmark.id}`, { data: { url, title: "Taken", description: null, tags: [] } })).status()).toBe(404);
  expect((await bobContext.request.delete(`/api/bookmarks/${bookmark.id}`)).status()).toBe(404);
  expect((await aliceContext.request.get("/api/bookmarks?query=Alice%20private")).status()).toBe(200);
  expect((await request.get("/api/bookmarks")).status()).toBe(401);
  await aliceContext.close();
  await bobContext.close();
});
