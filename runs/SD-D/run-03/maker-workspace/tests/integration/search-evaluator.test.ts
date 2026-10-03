import type { AppDatabase } from "../../src/server/db/database.js";
import {
  InvalidSearchCursorError,
  SearchRepository,
  type SearchRequest,
} from "../../src/server/repositories/search-repository.js";
import { compileSearchAst } from "../../src/server/services/search/search-compiler.js";
import { parseSearchQueryOrThrow } from "../../src/shared/search/parser.js";
import { withTestDatabase } from "../helpers/database.js";

const NOW = "2026-09-17T12:00:00.000Z";

interface SeedBookmark {
  id: number;
  title: string;
  address?: string;
  description?: string;
  note?: string;
  tags?: string[];
  favorite?: boolean;
  unread?: boolean;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function nameKey(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("und");
}

function seed(database: AppDatabase, bookmark: SeedBookmark): void {
  const address = bookmark.address ?? `https://example.test/${bookmark.id}`;
  const titleKey = nameKey(bookmark.title);
  database
    .prepare(`
      INSERT INTO bookmarks (
        id, address, normalized_address, title, title_sort_key, title_provenance,
        description, description_provenance, metadata_status, note_markdown, note_plain,
        is_favorite, is_unread, archived_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'user', ?, 'user', 'complete', '', ?, ?, ?, ?, ?, ?)
    `)
    .run(
      bookmark.id,
      address,
      address,
      bookmark.title,
      titleKey,
      bookmark.description ?? "",
      bookmark.note ?? "",
      bookmark.favorite ? 1 : 0,
      bookmark.unread ? 1 : 0,
      bookmark.archived ? NOW : null,
      bookmark.createdAt ?? NOW,
      bookmark.updatedAt ?? bookmark.createdAt ?? NOW,
    );

  for (const displayName of bookmark.tags ?? []) {
    const key = nameKey(displayName);
    database
      .prepare("INSERT OR IGNORE INTO tags(display_name, name_key, created_at) VALUES (?, ?, ?)")
      .run(displayName, key, NOW);
    database
      .prepare(`
        INSERT INTO bookmark_tags(bookmark_id, tag_id)
        SELECT ?, id FROM tags WHERE name_key = ?
      `)
      .run(bookmark.id, key);
  }
}

function request(overrides: Partial<SearchRequest> = {}): SearchRequest {
  return {
    scope: "active",
    query: "",
    tags: [],
    favorite: null,
    unread: null,
    sort: "created_desc",
    limit: 50,
    ...overrides,
  };
}

describe("search evaluator", () => {
  it("migrates constrained relational tags and transactionally maintains FTS membership", async () => {
    await withTestDatabase(({ database }) => {
      const tables = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE name IN ('tags', 'bookmark_tags', 'bookmark_search') ORDER BY name",
        )
        .all() as Array<{ name: string }>;
      expect(tables.map(({ name }) => name)).toEqual(["bookmark_search", "bookmark_tags", "tags"]);

      seed(database, { id: 1, title: "Initial searchable title", tags: ["News"] });
      expect(
        database
          .prepare("SELECT rowid FROM bookmark_search WHERE bookmark_search MATCH ?")
          .all('"searchable"'),
      ).toEqual([{ rowid: 1 }]);

      database.prepare("UPDATE bookmarks SET title = 'Replacement title' WHERE id = 1").run();
      expect(
        database
          .prepare("SELECT rowid FROM bookmark_search WHERE bookmark_search MATCH ?")
          .all('"searchable"'),
      ).toEqual([]);
      expect(
        database
          .prepare("SELECT rowid FROM bookmark_search WHERE bookmark_search MATCH ?")
          .all('"replacement"'),
      ).toEqual([{ rowid: 1 }]);

      expect(() =>
        database
          .prepare("INSERT INTO tags(display_name, name_key, created_at) VALUES (?, ?, ?)")
          .run("NEWS", "news", NOW),
      ).toThrow();
      database.prepare("DELETE FROM bookmarks WHERE id = 1").run();
      expect(database.prepare("SELECT count(*) AS count FROM bookmark_tags").get()).toEqual({
        count: 0,
      });
      expect(database.prepare("SELECT count(*) AS count FROM bookmark_search").get()).toEqual({
        count: 0,
      });
    });
  });

  it("composes adjacent terms across different searchable fields", async () => {
    await withTestDatabase(({ database }) => {
      seed(database, { id: 1, title: "Alpha handbook", note: "Includes beta examples" });
      seed(database, { id: 2, title: "Alpha only" });
      const repository = new SearchRepository(database);

      expect(repository.search(request({ query: "alpha beta" })).items.map(({ id }) => id)).toEqual(
        [1],
      );
    });
  });

  it("keeps quoted phrases within one field and never spans fields", async () => {
    await withTestDatabase(({ database }) => {
      seed(database, { id: 1, title: "red green reference" });
      seed(database, { id: 2, title: "red", description: "green" });
      const repository = new SearchRepository(database);

      expect(
        repository.search(request({ query: '"red green"' })).items.map(({ id }) => id),
      ).toEqual([1]);
    });
  });

  it("matches ordinary tag substrings and exact relational #tag atoms", async () => {
    await withTestDatabase(({ database }) => {
      seed(database, { id: 1, title: "One", tags: ["Machine Learning"] });
      seed(database, { id: 2, title: "Two", tags: ["Machine"] });
      const repository = new SearchRepository(database);

      expect(repository.search(request({ query: "learn" })).items.map(({ id }) => id)).toEqual([1]);
      expect(
        repository.search(request({ query: '#"machine learning"' })).items.map(({ id }) => id),
      ).toEqual([1]);
      expect(repository.search(request({ query: "#machine" })).items.map(({ id }) => id)).toEqual([
        2,
      ]);
    });
  });

  it("uses a bounded scan for one/two-character atoms and normalizes Unicode", async () => {
    await withTestDatabase(({ database }) => {
      seed(database, { id: 1, title: "A UI guide" });
      seed(database, { id: 2, title: "Ａlpha ÉCOLE" });
      const repository = new SearchRepository(database);
      repository.synchronizeBookmark(2);

      expect(repository.search(request({ query: "ui" })).items.map(({ id }) => id)).toEqual([1]);
      expect(
        repository.search(request({ query: "alpha école" })).items.map(({ id }) => id),
      ).toEqual([2]);
    });
  });

  it("requires every selected tag and combines status filters", async () => {
    await withTestDatabase(({ database }) => {
      seed(database, {
        id: 1,
        title: "Matching",
        tags: ["News", "Research"],
        favorite: true,
        unread: true,
      });
      seed(database, { id: 2, title: "One tag", tags: ["News"], favorite: true, unread: true });
      seed(database, {
        id: 3,
        title: "Wrong status",
        tags: ["News", "Research"],
        favorite: false,
        unread: true,
      });
      seed(database, {
        id: 4,
        title: "Explicit false statuses",
        tags: ["News", "Research"],
        favorite: false,
        unread: false,
      });
      const repository = new SearchRepository(database);

      const page = repository.search(
        request({ tags: [" NEWS ", "research"], favorite: true, unread: true }),
      );
      expect(page.items.map(({ id }) => id)).toEqual([1]);
      expect(page.items[0]?.tags.map(({ name }) => name)).toEqual(["News", "Research"]);
      expect(
        repository
          .search(request({ tags: ["news", "research"], favorite: false, unread: false }))
          .items.map(({ id }) => id),
      ).toEqual([4]);
    });
  });

  it("applies active, Read Later, and archived scope rules without clearing unread state", async () => {
    await withTestDatabase(({ database }) => {
      seed(database, { id: 1, title: "Active read" });
      seed(database, { id: 2, title: "Active unread", unread: true });
      seed(database, { id: 3, title: "Archived unread", unread: true, archived: true });
      const repository = new SearchRepository(database);

      expect(repository.search(request({ scope: "active" })).items.map(({ id }) => id)).toEqual([
        2, 1,
      ]);
      expect(repository.search(request({ scope: "read_later" })).items.map(({ id }) => id)).toEqual(
        [2],
      );
      expect(repository.search(request({ scope: "archived" })).items.map(({ id }) => id)).toEqual([
        3,
      ]);
      expect(repository.search(request({ scope: "archived" })).items[0]?.unread).toBe(true);
    });
  });

  it.each([
    ["created_desc", [3, 2, 1]],
    ["created_asc", [1, 2, 3]],
    ["updated_desc", [3, 2, 1]],
    ["title_asc", [2, 1, 3]],
  ] as const)("uses deterministic id tie-breakers for %s", async (sort, ids) => {
    await withTestDatabase(({ database }) => {
      seed(database, { id: 1, title: "Bravo", createdAt: NOW, updatedAt: NOW });
      seed(database, { id: 2, title: "Alpha", createdAt: NOW, updatedAt: NOW });
      seed(database, { id: 3, title: "Bravo", createdAt: NOW, updatedAt: NOW });
      const repository = new SearchRepository(database);
      expect(repository.search(request({ sort })).items.map(({ id }) => id)).toEqual(ids);
    });
  });

  it("returns a total independent of pages and a stable validated cursor", async () => {
    await withTestDatabase(({ database }) => {
      for (let id = 1; id <= 5; id += 1) seed(database, { id, title: `Item ${id}` });
      const repository = new SearchRepository(database);
      const first = repository.search(request({ limit: 2 }));
      const second = repository.search(
        request({ limit: 2, cursor: first.nextCursor ?? undefined }),
      );
      const third = repository.search(
        request({ limit: 2, cursor: second.nextCursor ?? undefined }),
      );

      expect(first.total).toBe(5);
      expect(first.items.map(({ id }) => id)).toEqual([5, 4]);
      expect(second.items.map(({ id }) => id)).toEqual([3, 2]);
      expect(third.items.map(({ id }) => id)).toEqual([1]);
      expect(third.nextCursor).toBeNull();
      expect(() => repository.search(request({ cursor: "not-a-cursor" }))).toThrow(
        InvalidSearchCursorError,
      );
      expect(() =>
        repository.search(request({ sort: "title_asc", cursor: first.nextCursor ?? undefined })),
      ).toThrow(InvalidSearchCursorError);
    });
  });

  it("binds atom values instead of interpolating them into SQL", () => {
    const hostile = `x' UNION SELECT id FROM bookmarks --`;
    const compiled = compileSearchAst(parseSearchQueryOrThrow(`"${hostile}"`));
    expect(compiled.sql).not.toContain(hostile);
    expect(compiled.parameters).toContain(hostile.normalize("NFKC").toLocaleLowerCase("und"));
  });
});
