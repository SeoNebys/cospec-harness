import { BookmarkRepository } from "../../src/server/repositories/bookmark-repository.js";
import {
  DuplicateSavedViewNameError,
  normalizeSavedViewName,
  SavedViewNotFoundError,
  SavedViewRepository,
} from "../../src/server/repositories/saved-view-repository.js";
import { SearchRepository } from "../../src/server/repositories/search-repository.js";
import {
  SavedViewService,
  toSearchCriteria,
} from "../../src/server/services/search/saved-view-service.js";
import type { SavedViewWrite } from "../../src/shared/contracts/api.js";
import { SearchQuerySyntaxError } from "../../src/shared/search/types.js";
import { createTestClock } from "../helpers/clock.js";
import { type TestDatabase, withTestDatabase } from "../helpers/database.js";

const FIRST_TIME = "2026-09-17T12:00:00.000Z";

function write(overrides: Partial<SavedViewWrite> = {}): SavedViewWrite {
  return {
    name: "Reading queue",
    query: 'alpha AND "deep dive"',
    tags: ["Research", "Long form"],
    scope: "read_later",
    favorite: true,
    unread: true,
    sort: "updated_desc",
    ...overrides,
  };
}

function makeService(fixture: TestDatabase) {
  const clock = createTestClock(FIRST_TIME);
  return {
    clock,
    repository: new SavedViewRepository(fixture.database),
    service: new SavedViewService(new SavedViewRepository(fixture.database), clock.now),
  };
}

function createBookmark(
  fixture: TestDatabase,
  id: number,
  title: string,
  options: { unread?: boolean; favorite?: boolean } = {},
): number {
  const address = `https://example.test/saved-view/${id}`;
  return new BookmarkRepository(fixture.database).create({
    input: { address, unread: options.unread, favorite: options.favorite, title },
    address,
    normalizedAddress: address,
    fallbackTitle: title,
    now: FIRST_TIME,
  }).id;
}

describe("saved-view persistence and validation", () => {
  it("migrates strict live-definition tables without bookmark result IDs", async () => {
    await withTestDatabase((fixture) => {
      const savedViewColumns = fixture.database
        .prepare("PRAGMA table_info(saved_views)")
        .all() as Array<{ name: string }>;
      const tagColumns = fixture.database
        .prepare("PRAGMA table_info(saved_view_tags)")
        .all() as Array<{ name: string }>;

      expect(savedViewColumns.map(({ name }) => name)).toEqual([
        "id",
        "display_name",
        "name_key",
        "query_text",
        "grammar_version",
        "scope",
        "favorite_filter",
        "unread_filter",
        "sort_order",
        "created_at",
        "updated_at",
      ]);
      expect(tagColumns.map(({ name }) => name)).toEqual([
        "saved_view_id",
        "tag_key",
        "display_name",
      ]);
      expect(savedViewColumns.map(({ name }) => name)).not.toContain("bookmark_ids");
    });
  });

  it("normalizes Unicode names, rejects equivalent names, and lists by normalized name", async () => {
    await withTestDatabase((fixture) => {
      const { service } = makeService(fixture);
      expect(normalizeSavedViewName("  Ｒｅａｄｉｎｇ Queue  ")).toEqual({
        displayName: "Ｒｅａｄｉｎｇ Queue",
        nameKey: "reading queue",
      });

      const reading = service.create(write({ name: "  Ｒｅａｄｉｎｇ Queue  " }));
      const archive = service.create(write({ name: "Archive audit", query: "", tags: [] }));
      expect(() => service.create(write({ name: "reading QUEUE" }))).toThrow(
        DuplicateSavedViewNameError,
      );
      expect(service.list().map(({ id }) => id)).toEqual([archive.id, reading.id]);
    });
  });

  it("validates grammar before create and leaves no partial rows", async () => {
    await withTestDatabase((fixture) => {
      const { service } = makeService(fixture);
      expect(() => service.create(write({ query: "alpha AND OR beta" }))).toThrow(
        SearchQuerySyntaxError,
      );
      expect(fixture.database.prepare("SELECT count(*) AS count FROM saved_views").get()).toEqual({
        count: 0,
      });
      expect(
        fixture.database.prepare("SELECT count(*) AS count FROM saved_view_tags").get(),
      ).toEqual({ count: 0 });
    });
  });

  it("atomically renames and replaces every criterion while retaining createdAt", async () => {
    await withTestDatabase((fixture) => {
      const { clock, repository, service } = makeService(fixture);
      const created = service.create(write());
      clock.advance({ minutes: 5 });
      const updated = service.update(
        created.id,
        write({
          name: "Fresh research",
          query: "beta OR #news",
          tags: ["News", " Missing Tag ", "ＮＥＷＳ"],
          scope: "archived",
          favorite: null,
          unread: false,
          sort: "title_asc",
        }),
      );

      expect(updated).toMatchObject({
        id: created.id,
        name: "Fresh research",
        query: "beta OR #news",
        tags: ["Missing Tag", "News"],
        scope: "archived",
        favorite: null,
        unread: false,
        sort: "title_asc",
        grammarVersion: 1,
        createdAt: FIRST_TIME,
        updatedAt: "2026-09-17T12:05:00.000Z",
      });

      service.create(write({ name: "Already used", query: "", tags: [] }));
      expect(() =>
        service.update(created.id, write({ name: "already USED", query: "changed" })),
      ).toThrow(DuplicateSavedViewNameError);
      expect(repository.get(created.id)).toEqual(updated);

      expect(() => service.update(created.id, write({ query: '"not closed' }))).toThrow(
        SearchQuerySyntaxError,
      );
      expect(repository.get(created.id)).toEqual(updated);
    });
  });

  it("stores grammar version 1 criteria and reevaluates them against current bookmarks", async () => {
    await withTestDatabase((fixture) => {
      const { service } = makeService(fixture);
      const search = new SearchRepository(fixture.database);
      const firstId = createBookmark(fixture, 1, "Alpha one", { unread: true });
      search.synchronizeBookmark(firstId);
      const saved = service.create(
        write({
          query: "alpha",
          tags: [],
          scope: "read_later",
          favorite: null,
          unread: null,
          sort: "created_asc",
        }),
      );

      expect(saved.grammarVersion).toBe(1);
      expect(search.search({ ...toSearchCriteria(saved), limit: 50 }).total).toBe(1);

      const secondId = createBookmark(fixture, 2, "Another alpha", { unread: true });
      search.synchronizeBookmark(secondId);
      expect(
        search.search({ ...service.criteriaFor(saved.id), limit: 50 }).items.map(({ id }) => id),
      ).toEqual([firstId, secondId]);
    });
  });

  it("preserves missing tag keys independently of the live tags table", async () => {
    await withTestDatabase((fixture) => {
      const { repository, service } = makeService(fixture);
      fixture.database
        .prepare("INSERT INTO tags (display_name, name_key, created_at) VALUES (?, ?, ?)")
        .run("Temporary", "temporary", FIRST_TIME);
      const saved = service.create(write({ query: "", tags: ["Temporary", "Gone already"] }));

      fixture.database.prepare("DELETE FROM tags WHERE name_key = ?").run("temporary");
      expect(repository.get(saved.id).tags).toEqual(["Gone already", "Temporary"]);
      expect(service.criteriaFor(saved.id).tags).toEqual(["Gone already", "Temporary"]);
    });
  });

  it("deletes only the saved definition and its criteria tags", async () => {
    await withTestDatabase((fixture) => {
      const { repository, service } = makeService(fixture);
      const bookmarkId = createBookmark(fixture, 1, "Keep me");
      const saved = service.create(write());

      service.delete(saved.id);
      expect(() => repository.get(saved.id)).toThrow(SavedViewNotFoundError);
      expect(
        fixture.database.prepare("SELECT count(*) AS count FROM saved_view_tags").get(),
      ).toEqual({ count: 0 });
      expect(new BookmarkRepository(fixture.database).get(bookmarkId).title).toBe("Keep me");
    });
  });
});
