import { BookmarkRepository } from "../../src/server/repositories/bookmark-repository.js";
import { SearchRepository } from "../../src/server/repositories/search-repository.js";
import {
  computeCriteriaHash,
  SelectionCriteriaHashError,
  SelectionExpiredError,
  SelectionRepository,
} from "../../src/server/repositories/selection-repository.js";
import { BulkActionService } from "../../src/server/services/selection/bulk-action-service.js";
import type { SearchCriteria } from "../../src/shared/contracts/api.js";
import { withTestDatabase } from "../helpers/database.js";

const START = "2026-09-17T12:00:00.000Z";

function criteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    scope: "active",
    query: "",
    tags: [],
    favorite: null,
    unread: null,
    sort: "created_desc",
    ...overrides,
  };
}

function createBookmark(
  repository: BookmarkRepository,
  id: number,
  overrides: { title?: string; favorite?: boolean; unread?: boolean; tags?: string[] } = {},
) {
  const address = `https://example.test/bulk/${id}`;
  return repository.create({
    input: {
      address,
      title: overrides.title ?? `Bookmark ${id}`,
      favorite: overrides.favorite,
      unread: overrides.unread,
      tags: overrides.tags,
    },
    address,
    normalizedAddress: address,
    fallbackTitle: `Bookmark ${id}`,
    now: START,
  });
}

describe("stable bulk selections", () => {
  it("materializes individual IDs and every off-screen result without later membership drift", async () => {
    await withTestDatabase(({ database }) => {
      const bookmarks = new BookmarkRepository(database);
      for (let id = 1; id <= 6; id += 1) {
        createBookmark(bookmarks, id, { title: id <= 5 ? `Match ${id}` : "Outside" });
      }
      const now = () => new Date(START);
      const selections = new SelectionRepository(database, now);
      const view = criteria({ query: "match" });
      const hash = computeCriteriaHash(view);
      const all = selections.createAllResults(view, hash);
      const individual = selections.createIds([1, 3, 999], hash);

      expect(all.selectedCount).toBe(5);
      expect(individual.selectedCount).toBe(2);
      expect(all.id).toMatch(/^[A-Za-z0-9_-]{32,}$/u);

      database.prepare("UPDATE bookmarks SET title = 'No longer matches' WHERE id = 1").run();
      database.prepare("UPDATE bookmarks SET title = 'Now match' WHERE id = 6").run();
      const result = new BulkActionService(database, now).apply(all.id, { type: "favorite" });
      expect(result).toEqual({ selectedCount: 5, processedCount: 5, changedCount: 5 });
      expect(
        database.prepare("SELECT id FROM bookmarks WHERE is_favorite = 1 ORDER BY id").all(),
      ).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    });
  });

  it("validates all-result view hashes and expires snapshots without applying changes", async () => {
    await withTestDatabase(({ database }) => {
      const bookmarks = new BookmarkRepository(database);
      createBookmark(bookmarks, 1);
      let current = new Date(START);
      const now = () => new Date(current);
      const selections = new SelectionRepository(database, now, { ttlMs: 1_000 });
      const bulk = new BulkActionService(database, now);
      const view = criteria();

      expect(() => selections.createAllResults(view, "sha256:not-the-view")).toThrow(
        SelectionCriteriaHashError,
      );
      const selection = selections.createAllResults(view, computeCriteriaHash(view));
      current = new Date(current.getTime() + 1_001);
      expect(() => bulk.apply(selection.id, { type: "mark_unread" })).toThrow(
        SelectionExpiredError,
      );
      expect(bookmarks.get(1).unread).toBe(false);
      expect(database.prepare("SELECT count(*) AS count FROM selection_sets").get()).toEqual({
        count: 0,
      });
    });
  });

  it("applies every tag/status/archive action with exact counts and out-of-set isolation", async () => {
    await withTestDatabase(({ database }) => {
      const bookmarks = new BookmarkRepository(database);
      createBookmark(bookmarks, 1, { favorite: true, tags: ["Keep"] });
      createBookmark(bookmarks, 2);
      createBookmark(bookmarks, 3);
      const now = () => new Date(START);
      const selections = new SelectionRepository(database, now);
      const bulk = new BulkActionService(database, now);
      const hash = computeCriteriaHash(criteria());
      const apply = (action: Parameters<BulkActionService["apply"]>[1]) => {
        const selection = selections.createIds([1, 2], hash);
        return bulk.apply(selection.id, action);
      };

      expect(apply({ type: "add_tags", tags: [" News ", "news"] })).toEqual({
        selectedCount: 2,
        processedCount: 2,
        changedCount: 2,
      });
      expect(apply({ type: "remove_tags", tags: ["news"] }).changedCount).toBe(2);
      expect(apply({ type: "favorite" }).changedCount).toBe(1);
      expect(apply({ type: "unfavorite" }).changedCount).toBe(2);
      expect(apply({ type: "mark_unread" }).changedCount).toBe(2);
      expect(apply({ type: "mark_read" }).changedCount).toBe(2);
      expect(apply({ type: "archive" }).changedCount).toBe(2);
      expect(apply({ type: "restore" }).changedCount).toBe(2);

      expect(bookmarks.get(3)).toMatchObject({ favorite: false, unread: false, archived: false });
      expect(bookmarks.get(1).tags.map(({ name }) => name)).toEqual(["Keep"]);
      expect(database.prepare("SELECT display_name FROM tags ORDER BY name_key").all()).toEqual([
        { display_name: "Keep" },
      ]);
    });
  });

  it("consumes once, deletes dependents/search rows, and reports the stable count", async () => {
    await withTestDatabase(({ database }) => {
      const bookmarks = new BookmarkRepository(database);
      createBookmark(bookmarks, 1, { tags: ["Only selected"] });
      createBookmark(bookmarks, 2, { tags: ["Outside"] });
      const now = () => new Date(START);
      const selections = new SelectionRepository(database, now);
      const selection = selections.createIds([1], computeCriteriaHash(criteria()));
      const bulk = new BulkActionService(database, now);

      expect(bulk.apply(selection.id, { type: "delete" })).toEqual({
        selectedCount: 1,
        processedCount: 1,
        changedCount: 1,
      });
      expect(() => bulk.apply(selection.id, { type: "delete" })).toThrow(/selection/i);
      expect(database.prepare("SELECT rowid FROM bookmark_search WHERE rowid = 1").all()).toEqual(
        [],
      );
      expect(database.prepare("SELECT display_name FROM tags ORDER BY name_key").all()).toEqual([
        { display_name: "Outside" },
      ]);
      expect(new SearchRepository(database).search({ ...criteria(), limit: 50 }).total).toBe(1);
    });
  });

  it("rolls back mutations and preserves the selection when a database step fails", async () => {
    await withTestDatabase(({ database }) => {
      const bookmarks = new BookmarkRepository(database);
      createBookmark(bookmarks, 1);
      createBookmark(bookmarks, 2);
      const now = () => new Date(START);
      const selections = new SelectionRepository(database, now);
      const selection = selections.createIds([1, 2], computeCriteriaHash(criteria()));
      database.exec(`
        CREATE TRIGGER fail_bulk_favorite
        BEFORE UPDATE OF is_favorite ON bookmarks
        WHEN new.id = 2
        BEGIN
          SELECT RAISE(ABORT, 'injected bulk failure');
        END
      `);

      expect(() =>
        new BulkActionService(database, now).apply(selection.id, { type: "favorite" }),
      ).toThrow(/injected bulk failure/u);
      expect(database.prepare("SELECT sum(is_favorite) AS count FROM bookmarks").get()).toEqual({
        count: 0,
      });
      expect(selections.get(selection.id)?.selectedCount).toBe(2);
    });
  });
});
