import { randomUUID } from "node:crypto";
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import Database from "better-sqlite3";

interface SeedBookmark {
  address: string;
  title: string;
  description: string;
  favorite: boolean;
  unread: boolean;
}

async function seedBookmark(page: Page, input: SeedBookmark): Promise<number> {
  const response: APIResponse = await page.request.post("/api/bookmarks", { data: input });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id as number;
}

function attachTags(entries: Array<{ bookmarkId: number; names: string[] }>): void {
  const database = new Database("data/e2e.sqlite");
  const now = new Date().toISOString();
  const insertTag = database.prepare(
    "INSERT OR IGNORE INTO tags(display_name, name_key, created_at) VALUES (?, ?, ?)",
  );
  const attach = database.prepare(`
    INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id)
    SELECT ?, id FROM tags WHERE name_key = ?
  `);
  try {
    database.transaction(() => {
      for (const entry of entries) {
        for (const name of entry.names) {
          const key = name.normalize("NFKC").toLocaleLowerCase("und");
          insertTag.run(name, key, now);
          attach.run(entry.bookmarkId, key);
        }
      }
    })();
  } finally {
    database.close();
  }
}

async function submitSearch(page: Page, query: string): Promise<void> {
  const search = page.getByRole("searchbox", { name: "Search bookmarks" });
  await search.fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(query);
}

async function visibleBookmarkNames(page: Page): Promise<string[]> {
  const articles = page
    .getByRole("region", { name: "Bookmarks", exact: true })
    .getByRole("article");
  return articles.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label") ?? ""),
  );
}

async function expectResults(page: Page, expectedTitles: string[]): Promise<void> {
  await expect
    .poll(() => visibleBookmarkNames(page), { message: "visible bookmark result titles" })
    .toEqual(expectedTitles);
}

test("search expressions, filters, errors, URL state, clearing, and sorts compose", async ({
  page,
}) => {
  const token = `search${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const alpha = `${token} Alpha Climate`;
  const bravo = `${token} Bravo Climate`;
  const charlie = `${token} Charlie Ocean`;
  const delta = `${token} Delta Orchard`;
  const newsTag = `${token}news`;
  const researchTag = `${token}research`;

  const seeds: SeedBookmark[] = [
    {
      address: `https://search-fixture.invalid/${token}/alpha`,
      title: alpha,
      description: "Crimson tide field notes",
      favorite: true,
      unread: true,
    },
    {
      address: `https://search-fixture.invalid/${token}/bravo`,
      title: bravo,
      description: "Solar systems briefing",
      favorite: true,
      unread: false,
    },
    {
      address: `https://search-fixture.invalid/${token}/charlie`,
      title: charlie,
      description: "Crimson meadow observations",
      favorite: false,
      unread: true,
    },
    {
      address: `https://search-fixture.invalid/${token}/delta`,
      title: delta,
      description: "Tidal orchard atlas",
      favorite: false,
      unread: false,
    },
  ];

  await page.goto("/");
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const ids: number[] = [];
  for (const seed of seeds) ids.push(await seedBookmark(page, seed));
  attachTags([
    { bookmarkId: ids[0] as number, names: [newsTag, researchTag] },
    { bookmarkId: ids[1] as number, names: [newsTag] },
  ]);
  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  await test.step("ordinary partial terms use implicit AND and survive reload through the URL", async () => {
    const query = `${token} climat`;
    await submitSearch(page, query);
    await expectResults(page, [bravo, alpha]);

    await page.reload();
    await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search bookmarks" })).toHaveValue(query);
    await expectResults(page, [bravo, alpha]);
  });

  await test.step("quoted phrases stay in one field and explicit AND is accepted", async () => {
    await submitSearch(page, `"crimson tide" AND ${token}`);
    await expectResults(page, [alpha]);
  });

  await test.step("OR returns either matching branch", async () => {
    await submitSearch(page, `${token} ocean OR ${token} orchard`);
    await expectResults(page, [delta, charlie]);
  });

  await test.step("exact #tag search and multiple required tag filters compose", async () => {
    await submitSearch(page, `#${newsTag}`);
    await expectResults(page, [bravo, alpha]);

    await page.getByRole("checkbox", { name: new RegExp(`${newsTag}.*2`, "i") }).check();
    await page.getByRole("checkbox", { name: new RegExp(`${researchTag}.*1`, "i") }).check();
    await expectResults(page, [alpha]);
    await page.getByRole("button", { name: "Clear search and filters" }).click();
  });

  await test.step("invalid syntax is actionable and does not replace the active query", async () => {
    const activeQuery = new URL(page.url()).searchParams.get("q");
    const search = page.getByRole("searchbox", { name: "Search bookmarks" });
    await search.fill('"unfinished');
    await expect(page.getByRole("alert")).toContainText(/close the quoted phrase/i);
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeDisabled();
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(activeQuery);
  });

  await test.step("sort choices are URL-backed and reorder the same result set", async () => {
    await submitSearch(page, token);
    const sort = page.getByRole("combobox", { name: "Sort bookmarks" });

    await sort.selectOption("title_asc");
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("title_asc");
    await expectResults(page, [alpha, bravo, charlie, delta]);

    await sort.selectOption("created_desc");
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBeNull();
    await expectResults(page, [delta, charlie, bravo, alpha]);
  });

  await test.step("favorite and reading filters combine without losing the search", async () => {
    await page
      .getByRole("combobox", { name: "Favorite filter" })
      .selectOption({ label: "Favorites only" });
    await page
      .getByRole("combobox", { name: "Reading filter" })
      .selectOption({ label: "Read Later" });

    await expect.poll(() => new URL(page.url()).searchParams.get("favorite")).toBe("true");
    await expect.poll(() => new URL(page.url()).searchParams.get("unread")).toBe("true");
    await expectResults(page, [alpha]);
  });

  await test.step("clear removes search and filter criteria from controls and URL", async () => {
    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await expect(page.getByRole("searchbox", { name: "Search bookmarks" })).toHaveValue("");
    await expect(page.getByRole("combobox", { name: "Favorite filter" })).toHaveValue("any");
    await expect(page.getByRole("combobox", { name: "Reading filter" })).toHaveValue("any");
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("favorite")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("unread")).toBeNull();
  });
});
