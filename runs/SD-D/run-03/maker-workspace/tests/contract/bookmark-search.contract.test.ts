import { Value } from "typebox/value";

import { buildApp } from "../../src/server/app.js";
import { normalizeTagName, TagRepository } from "../../src/server/repositories/tag-repository.js";
import { registerTagRoutes } from "../../src/server/routes/tags.js";
import { BookmarkPageSchema, TagSummaryListSchema } from "../../src/shared/contracts/api.js";
import { SearchProblemSchema } from "../../src/shared/contracts/errors.js";
import { type TestDatabase, withTestDatabase } from "../helpers/database.js";
import { withFastifyTestHarness } from "../helpers/fastify.js";

const CREATED_AT = "2026-09-17T12:00:00.000Z";

function insertBookmark(
  fixture: TestDatabase,
  values: {
    id: number;
    title: string;
    favorite?: boolean;
    unread?: boolean;
    archived?: boolean;
    createdAt?: string;
  },
): void {
  const address = `https://example.test/${values.id}`;
  fixture.database
    .prepare(`
      INSERT INTO bookmarks (
        id, address, normalized_address, title, title_sort_key, title_provenance,
        description, description_provenance, metadata_status, note_markdown,
        note_plain, is_favorite, is_unread, archived_at, created_at, updated_at
      ) VALUES (
        @id, @address, @address, @title, @titleSortKey, 'user', '', 'fallback',
        'complete', '', '', @favorite, @unread, @archivedAt, @createdAt, @createdAt
      )
    `)
    .run({
      id: values.id,
      address,
      title: values.title,
      titleSortKey: values.title.normalize("NFKC").toLocaleLowerCase("und"),
      favorite: values.favorite ? 1 : 0,
      unread: values.unread ? 1 : 0,
      archivedAt: values.archived ? CREATED_AT : null,
      createdAt: values.createdAt ?? CREATED_AT,
    });
}

function insertTag(
  fixture: TestDatabase,
  values: { id: number; name: string; bookmarkIds?: number[] },
): void {
  const normalized = normalizeTagName(values.name);
  fixture.database
    .prepare("INSERT INTO tags (id, display_name, name_key, created_at) VALUES (?, ?, ?, ?)")
    .run(values.id, normalized.displayName, normalized.nameKey, CREATED_AT);
  const relate = fixture.database.prepare(
    "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
  );
  for (const bookmarkId of values.bookmarkIds ?? []) relate.run(bookmarkId, values.id);
}

describe("bookmark search HTTP contract", () => {
  it("accepts every documented query parameter and returns a contract-shaped page", async () => {
    await withFastifyTestHarness(
      async ({ injectJson }) => {
        const response = await injectJson({
          method: "GET",
          url: "/api/bookmarks?scope=read_later&q=alpha%20AND%20%23news&tag=News&tag=Research&favorite=true&unread=true&sort=title_asc&limit=10",
        });

        expect(response.statusCode).toBe(200);
        expect(Value.Check(BookmarkPageSchema, response.json())).toBe(true);
        expect(response.json()).toMatchObject({ total: 1, nextCursor: null });
        expect(response.json().items.map((bookmark: { id: number }) => bookmark.id)).toEqual([1]);
      },
      {
        beforeBuild: (fixture) => {
          insertBookmark(fixture, {
            id: 1,
            title: "Alpha article",
            favorite: true,
            unread: true,
          });
          insertBookmark(fixture, {
            id: 2,
            title: "Alpha article without every filter",
            unread: true,
          });
          insertTag(fixture, { id: 1, name: "News", bookmarkIds: [1, 2] });
          insertTag(fixture, { id: 2, name: "Research", bookmarkIds: [1] });
        },
      },
    );
  });

  it("returns stable cursor pages without repeating bookmarks", async () => {
    await withFastifyTestHarness(
      async ({ injectJson }) => {
        const first = await injectJson({
          method: "GET",
          url: "/api/bookmarks?sort=created_desc&limit=2",
        });
        expect(first.statusCode).toBe(200);
        expect(Value.Check(BookmarkPageSchema, first.json())).toBe(true);
        expect(first.json()).toMatchObject({ total: 3 });
        expect(typeof first.json().nextCursor).toBe("string");

        const second = await injectJson({
          method: "GET",
          url: `/api/bookmarks?sort=created_desc&limit=2&cursor=${encodeURIComponent(first.json().nextCursor)}`,
        });
        expect(second.statusCode).toBe(200);
        expect(Value.Check(BookmarkPageSchema, second.json())).toBe(true);
        expect(second.json()).toMatchObject({ total: 3, nextCursor: null });

        const firstIds = first.json().items.map((bookmark: { id: number }) => bookmark.id);
        const secondIds = second.json().items.map((bookmark: { id: number }) => bookmark.id);
        expect(firstIds).toHaveLength(2);
        expect(secondIds).toHaveLength(1);
        expect(new Set([...firstIds, ...secondIds]).size).toBe(3);
      },
      {
        beforeBuild: (fixture) => {
          insertBookmark(fixture, {
            id: 1,
            title: "Oldest",
            createdAt: "2026-09-15T12:00:00.000Z",
          });
          insertBookmark(fixture, {
            id: 2,
            title: "Middle",
            createdAt: "2026-09-16T12:00:00.000Z",
          });
          insertBookmark(fixture, { id: 3, title: "Newest", createdAt: CREATED_AT });
        },
      },
    );
  });

  it("returns a position-aware SearchProblem instead of partial results", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const response = await injectJson({
        method: "GET",
        url: "/api/bookmarks?q=alpha%20AND%20OR%20beta",
      });

      expect(response.statusCode).toBe(422);
      expect(Value.Check(SearchProblemSchema, response.json())).toBe(true);
      expect(response.json()).toEqual({
        code: "DOUBLE_OPERATOR",
        message: "Two operators cannot appear together.",
        field: "q",
        start: 10,
        end: 12,
        hint: "Remove one operator or add a term between them",
      });
    });
  });
});

describe("tag read contract", () => {
  it("normalizes keys with NFKC, collapsed whitespace, and locale-independent lowercase", () => {
    expect(normalizeTagName("  ＮＥＷＳ\t  Café  ")).toEqual({
      displayName: "ＮＥＷＳ Café",
      nameKey: "news café",
    });
    expect(() => normalizeTagName(" \n\t ")).toThrowError(/tag name/i);
  });

  it("reads exact and partial matches by normalized keys without SQLite NOCASE", async () => {
    await withTestDatabase((fixture) => {
      insertBookmark(fixture, { id: 1, title: "One" });
      insertTag(fixture, { id: 1, name: "Café News", bookmarkIds: [1] });
      insertTag(fixture, { id: 2, name: "Machine Learning" });
      insertTag(fixture, { id: 3, name: "Local news" });
      const repository = new TagRepository(fixture.database);

      expect(repository.findExact("  ＣＡＦÉ   NEWS ")).toMatchObject({
        id: 1,
        name: "Café News",
      });
      expect(repository.findPartial("ＮＥＷＳ").map((tag) => tag.name)).toEqual([
        "Café News",
        "Local news",
      ]);
      expect(repository.findPartial("learning", 1)).toEqual([
        { id: 2, name: "Machine Learning", activeBookmarkCount: 0 },
      ]);
    });
  });

  it("returns tag summaries with active-only bookmark counts", async () => {
    await withFastifyTestHarness(
      async ({ injectJson }) => {
        const response = await injectJson({ method: "GET", url: "/api/tags" });

        expect(response.statusCode).toBe(200);
        expect(Value.Check(TagSummaryListSchema, response.json())).toBe(true);
        expect(response.json()).toEqual([
          { id: 2, name: "Machine Learning", activeBookmarkCount: 0 },
          { id: 1, name: "News", activeBookmarkCount: 1 },
        ]);
      },
      {
        beforeBuild: (fixture) => {
          insertBookmark(fixture, { id: 1, title: "Active" });
          insertBookmark(fixture, { id: 2, title: "Archived", archived: true });
          insertTag(fixture, { id: 1, name: "News", bookmarkIds: [1, 2] });
          insertTag(fixture, { id: 2, name: "Machine Learning" });
        },
        build: async (dependencies) => {
          const app = await buildApp(dependencies);
          if (!app.hasRoute({ method: "GET", url: "/api/tags" })) {
            await registerTagRoutes(app);
          }
          return app;
        },
      },
    );
  });
});
