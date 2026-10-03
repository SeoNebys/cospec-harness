import { randomUUID } from "node:crypto";
import { type APIResponse, expect, type Page, test } from "@playwright/test";

interface SeedBookmark {
  address: string;
  title: string;
  favorite?: boolean;
  unread?: boolean;
  tags?: string[];
}

interface BookmarkState {
  id: number;
  favorite: boolean;
  unread: boolean;
  archived: boolean;
  tags: Array<{ name: string }>;
}

interface BulkResult {
  selectedCount: number;
  processedCount: number;
  changedCount: number;
}

async function seedBookmark(page: Page, input: SeedBookmark): Promise<number> {
  const response: APIResponse = await page.request.post("/api/bookmarks", { data: input });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as BookmarkState).id;
}

async function patchBookmark(
  page: Page,
  bookmarkId: number,
  input: Record<string, unknown>,
): Promise<void> {
  const response = await page.request.patch(`/api/bookmarks/${bookmarkId}`, { data: input });
  expect(response.status(), await response.text()).toBe(200);
}

async function readBookmark(page: Page, bookmarkId: number): Promise<BookmarkState> {
  const response = await page.request.get(`/api/bookmarks/${bookmarkId}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as BookmarkState;
}

async function submitSearch(page: Page, query: string): Promise<void> {
  await page.getByRole("searchbox", { name: "Search bookmarks" }).fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(query);
}

async function selectBookmark(page: Page, title: string): Promise<void> {
  await page.getByRole("checkbox", { name: `Select ${title}`, exact: true }).check();
  await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText(
    "1 bookmark selected",
  );
}

async function applyStateAction(
  page: Page,
  label: string,
  expected: BulkResult = { selectedCount: 1, processedCount: 1, changedCount: 1 },
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/selections\/[^/]+\/actions$/u.test(new URL(response.url()).pathname),
  );
  await page
    .getByRole("region", { name: "Bulk actions" })
    .getByRole("button", { name: label, exact: true })
    .click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect((await response.json()) as BulkResult).toEqual(expected);
}

async function applyTagAction(
  page: Page,
  label: "Add tags" | "Remove tags",
  tag: string,
): Promise<void> {
  const bulkActions = page.getByRole("region", { name: "Bulk actions" });
  await bulkActions.getByRole("textbox", { name: "Bulk tags", exact: true }).fill(tag);
  await applyStateAction(page, label);
}

test("bulk actions use stable complete-result snapshots and never affect bookmarks outside them", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const token = `bulk${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const pageToken = `${token}page`;
  const pageTitles = Array.from(
    { length: 52 },
    (_, index) => `${pageToken} Item ${String(index + 1).padStart(2, "0")}`,
  );
  const actionTitles = {
    clear: `${token} Clear on view change`,
    favorite: `${token} Favorite target`,
    unfavorite: `${token} Unfavorite target`,
    unread: `${token} Mark unread target`,
    read: `${token} Mark read target`,
    archive: `${token} Archive target`,
    restore: `${token} Restore target`,
    addTag: `${token} Add tag target`,
    removeTag: `${token} Remove tag target`,
  };
  const addedTag = `${token} added`;
  const removedTag = `${token} removable`;
  const deleteToken = `${token}delete`;
  const deleteTitles = [`${deleteToken} One`, `${deleteToken} Two`];

  await page.goto("/");
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  const pageIds: number[] = [];
  for (const [index, title] of pageTitles.entries()) {
    pageIds.push(
      await seedBookmark(page, {
        address: `https://bulk-fixture.invalid/${token}/page/${index + 1}`,
        title,
      }),
    );
  }

  const clearId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/clear`,
    title: actionTitles.clear,
  });
  const favoriteId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/favorite`,
    title: actionTitles.favorite,
  });
  const unfavoriteId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/unfavorite`,
    title: actionTitles.unfavorite,
    favorite: true,
  });
  const unreadId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/unread`,
    title: actionTitles.unread,
  });
  const readId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/read`,
    title: actionTitles.read,
    unread: true,
  });
  const archiveId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/archive`,
    title: actionTitles.archive,
  });
  const restoreId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/restore`,
    title: actionTitles.restore,
  });
  await patchBookmark(page, restoreId, { archived: true });
  const addTagId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/add-tag`,
    title: actionTitles.addTag,
  });
  const removeTagId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/remove-tag`,
    title: actionTitles.removeTag,
    tags: [removedTag],
  });
  const coldIsolationId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/cold-isolation`,
    title: `${token} Cold isolation`,
  });
  const hotIsolationId = await seedBookmark(page, {
    address: `https://bulk-fixture.invalid/${token}/hot-isolation`,
    title: `${token} Hot isolation`,
    favorite: true,
    unread: true,
    tags: [removedTag],
  });
  await patchBookmark(page, hotIsolationId, { archived: true });
  const deleteIds = [
    await seedBookmark(page, {
      address: `https://bulk-fixture.invalid/${token}/delete/one`,
      title: deleteTitles[0] as string,
    }),
    await seedBookmark(page, {
      address: `https://bulk-fixture.invalid/${token}/delete/two`,
      title: deleteTitles[1] as string,
    }),
  ];

  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  await test.step("select all filtered results across pagination and freeze membership", async () => {
    await submitSearch(page, pageToken);
    await page.getByRole("combobox", { name: "Reading filter" }).selectOption("false");
    await expect(page.getByText("52 bookmarks in this view.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load more results" })).toBeVisible();
    const visibleTitles = await page
      .getByRole("region", { name: "Bookmarks", exact: true })
      .getByRole("article")
      .evaluateAll((articles) => articles.map((article) => article.getAttribute("aria-label")));
    expect(visibleTitles).toHaveLength(50);
    expect(pageTitles.filter((title) => !visibleTitles.includes(title))).toHaveLength(2);

    await page.getByRole("button", { name: "Select all 52 results" }).click();
    const selection = page.getByRole("region", { name: "Select bookmarks" });
    await expect(selection.getByRole("status", { name: "Selection count" })).toHaveText(
      "52 bookmarks selected",
    );
    await expect(selection).toContainText("2 results not shown on this page");
    await expect(selection).toContainText("Later collection changes will not alter this snapshot");

    const driftId = await seedBookmark(page, {
      address: `https://bulk-fixture.invalid/${token}/page/drift`,
      title: `${pageToken} Later match`,
    });
    await applyStateAction(page, "Favorite", {
      selectedCount: 52,
      processedCount: 52,
      changedCount: 52,
    });

    for (const id of pageIds) expect((await readBookmark(page, id)).favorite).toBe(true);
    expect((await readBookmark(page, driftId)).favorite).toBe(false);
    expect((await readBookmark(page, coldIsolationId)).favorite).toBe(false);
  });

  await page.getByRole("button", { name: "Clear search and filters" }).click();

  await test.step("changing the current view clears an unconsumed selection", async () => {
    await submitSearch(page, actionTitles.clear);
    await selectBookmark(page, actionTitles.clear);
    await submitSearch(page, actionTitles.favorite);
    await expect(page.getByRole("region", { name: "Bulk actions" })).toHaveCount(0);
    await expect(page.getByRole("status", { name: "Selection count" })).toHaveText(
      "0 bookmarks selected",
    );
    expect(await readBookmark(page, clearId).then((bookmark) => bookmark.favorite)).toBe(false);
  });

  await test.step("apply every non-delete state action to isolated selections", async () => {
    await selectBookmark(page, actionTitles.favorite);
    await applyStateAction(page, "Favorite");
    expect((await readBookmark(page, favoriteId)).favorite).toBe(true);

    await submitSearch(page, actionTitles.unfavorite);
    await selectBookmark(page, actionTitles.unfavorite);
    await applyStateAction(page, "Unfavorite");
    expect((await readBookmark(page, unfavoriteId)).favorite).toBe(false);

    await submitSearch(page, actionTitles.unread);
    await selectBookmark(page, actionTitles.unread);
    await applyStateAction(page, "Mark unread");
    expect((await readBookmark(page, unreadId)).unread).toBe(true);

    await submitSearch(page, actionTitles.read);
    await selectBookmark(page, actionTitles.read);
    await applyStateAction(page, "Mark read");
    expect((await readBookmark(page, readId)).unread).toBe(false);

    await submitSearch(page, actionTitles.archive);
    await selectBookmark(page, actionTitles.archive);
    await applyStateAction(page, "Archive");
    expect((await readBookmark(page, archiveId)).archived).toBe(true);

    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await submitSearch(page, actionTitles.restore);
    await selectBookmark(page, actionTitles.restore);
    await applyStateAction(page, "Restore");
    expect((await readBookmark(page, restoreId)).archived).toBe(false);
  });

  await test.step("add and remove tags through the bulk toolbar", async () => {
    await page.getByRole("link", { name: "Bookmarks", exact: true }).click();
    await submitSearch(page, actionTitles.addTag);
    await selectBookmark(page, actionTitles.addTag);
    await applyTagAction(page, "Add tags", addedTag);
    expect((await readBookmark(page, addTagId)).tags.map((tag) => tag.name)).toContain(addedTag);

    await submitSearch(page, actionTitles.removeTag);
    await selectBookmark(page, actionTitles.removeTag);
    await applyTagAction(page, "Remove tags", removedTag);
    expect((await readBookmark(page, removeTagId)).tags.map((tag) => tag.name)).not.toContain(
      removedTag,
    );
  });

  await test.step("cancelled deletion changes nothing and confirmed deletion uses the exact count", async () => {
    await submitSearch(page, deleteToken);
    await page.getByRole("button", { name: "Select 2 on this page" }).click();
    const bulkActions = page.getByRole("region", { name: "Bulk actions" });
    await expect(bulkActions).toContainText("2 bookmarks selected");
    await bulkActions.getByRole("button", { name: "Permanently delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete 2 bookmarks?" });
    await expect(dialog).toContainText(
      "This permanently removes every selected bookmark and cannot be undone.",
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    for (const id of deleteIds) expect((await readBookmark(page, id)).id).toBe(id);

    await bulkActions.getByRole("button", { name: "Permanently delete" }).click();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/selections\/[^/]+\/actions$/u.test(new URL(response.url()).pathname),
    );
    await page
      .getByRole("dialog", { name: "Delete 2 bookmarks?" })
      .getByRole("button", { name: "Delete 2 bookmarks", exact: true })
      .click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect((await response.json()) as BulkResult).toEqual({
      selectedCount: 2,
      processedCount: 2,
      changedCount: 2,
    });
    for (const id of deleteIds) {
      expect((await page.request.get(`/api/bookmarks/${id}`)).status()).toBe(404);
    }
  });

  await test.step("bookmarks outside every selected set retain their original state", async () => {
    const cold = await readBookmark(page, coldIsolationId);
    expect(cold).toMatchObject({ favorite: false, unread: false, archived: false });
    expect(cold.tags.map((tag) => tag.name)).not.toContain(addedTag);

    const hot = await readBookmark(page, hotIsolationId);
    expect(hot).toMatchObject({ favorite: true, unread: true, archived: true });
    expect(hot.tags.map((tag) => tag.name)).toContain(removedTag);
  });
});
