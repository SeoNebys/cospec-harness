import { randomUUID } from "node:crypto";
import { type APIResponse, expect, type Page, test } from "@playwright/test";

interface SeedBookmark {
  address: string;
  title: string;
  favorite: boolean;
}

async function seedBookmark(page: Page, input: SeedBookmark): Promise<number> {
  const response: APIResponse = await page.request.post("/api/bookmarks", { data: input });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id as number;
}

async function submitSearch(page: Page, query: string): Promise<void> {
  await page.getByRole("searchbox", { name: "Search bookmarks" }).fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(query);
}

test("saved views remain live, preserve missing tags, update, and delete without bookmarks", async ({
  page,
}) => {
  const token = `view${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const initialTitle = `${token} Initial favorite`;
  const replacementTitle = `${token} New favorite`;
  const ignoredTitle = `${token} Not favorite`;
  const viewName = `${token} reading list`;
  const renamedView = `${token} renamed`;
  const missingTag = `${token}-removed-tag`;

  await page.goto("/");
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const initialId = await seedBookmark(page, {
    address: `https://saved-view.invalid/${token}/initial`,
    title: initialTitle,
    favorite: true,
  });
  await seedBookmark(page, {
    address: `https://saved-view.invalid/${token}/ignored`,
    title: ignoredTitle,
    favorite: false,
  });
  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  await test.step("save the exact current query, filter, scope, and sort", async () => {
    await submitSearch(page, token);
    await page
      .getByRole("combobox", { name: "Favorite filter" })
      .selectOption({ label: "Favorites only" });
    await page.getByRole("combobox", { name: "Sort bookmarks" }).selectOption("title_asc");
    await expect(page.getByRole("article", { name: initialTitle })).toBeVisible();
    await expect(page.getByRole("article", { name: ignoredTitle })).toHaveCount(0);

    await page.getByRole("button", { name: "Save current" }).click();
    await page.getByRole("textbox", { name: "View name" }).fill(viewName);
    await page.getByRole("button", { name: "Save view" }).click();
    await expect(page.getByRole("button", { name: viewName, exact: true })).toBeVisible();
  });

  await test.step("opening the view reevaluates current bookmark data", async () => {
    const unfavorite = await page.request.patch(`/api/bookmarks/${initialId}`, {
      data: { favorite: false },
    });
    expect(unfavorite.ok(), await unfavorite.text()).toBeTruthy();
    await seedBookmark(page, {
      address: `https://saved-view.invalid/${token}/replacement`,
      title: replacementTitle,
      favorite: true,
    });

    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await page.getByRole("button", { name: viewName, exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).not.toBeNull();
    await expect(page.getByRole("searchbox", { name: "Search bookmarks" })).toHaveValue(token);
    await expect(page.getByRole("combobox", { name: "Favorite filter" })).toHaveValue("true");
    await expect(page.getByRole("combobox", { name: "Sort bookmarks" })).toHaveValue("title_asc");
    await expect(page.getByRole("article", { name: replacementTitle })).toBeVisible();
    await expect(page.getByRole("article", { name: initialTitle })).toHaveCount(0);
  });

  await test.step("rename and replace the reusable definition", async () => {
    await page.getByRole("button", { name: `Edit ${viewName}` }).click();
    const name = page.getByRole("textbox", { name: "View name" });
    await name.fill(renamedView);
    await page.getByRole("button", { name: "Update view" }).click();
    await expect(page.getByRole("button", { name: renamedView, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: viewName, exact: true })).toHaveCount(0);
  });

  await test.step("a missing tag criterion stays visible and yields a truthful empty result", async () => {
    const response = await page.request.post("/api/saved-views", {
      data: {
        name: `${token} missing tag`,
        scope: "active",
        query: token,
        tags: [missingTag],
        favorite: null,
        unread: null,
        sort: "created_desc",
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    await page.reload();
    await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
    await page.getByRole("button", { name: `${token} missing tag`, exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `Missing tag filter: ${missingTag}` }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "No bookmarks match this view" })).toBeVisible();
  });

  await test.step("cancel keeps a saved view; confirm removes only the definition", async () => {
    await page.getByRole("button", { name: `Delete ${renamedView}` }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: renamedView, exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Delete ${renamedView}` }).click();
    await page.getByRole("button", { name: "Delete saved view" }).click();
    await expect(page.getByRole("button", { name: renamedView, exact: true })).toHaveCount(0);

    const bookmarkResponse = await page.request.get(`/api/bookmarks/${initialId}`);
    expect(bookmarkResponse.status()).toBe(200);
  });
});
