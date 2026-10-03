import {
  BookmarkNotFoundError,
  BookmarkRepository,
} from "../../src/server/repositories/bookmark-repository.js";
import { BookmarkStateService } from "../../src/server/services/bookmarks/bookmark-state-service.js";
import { type TestDatabase, withTestDatabase } from "../helpers/database.js";
import { withFastifyTestHarness } from "../helpers/fastify.js";

const FIRST_TIME = "2026-09-17T12:00:00.000Z";
const SECOND_TIME = "2026-09-17T12:05:00.000Z";

function createBookmark(
  fixture: TestDatabase,
  values: { id: number; favorite?: boolean; unread?: boolean },
) {
  const repository = new BookmarkRepository(fixture.database);
  const address = `https://example.test/read-later/${values.id}`;
  return repository.create({
    input: {
      address,
      favorite: values.favorite,
      unread: values.unread,
    },
    address,
    normalizedAddress: address,
    fallbackTitle: `Bookmark ${values.id}`,
    now: FIRST_TIME,
  });
}

describe("Read Later repository state", () => {
  it("creates bookmarks as read unless Read Later is explicitly selected", async () => {
    await withTestDatabase((fixture) => {
      const read = createBookmark(fixture, { id: 1 });
      const unread = createBookmark(fixture, { id: 2, unread: true });

      expect(read.unread).toBe(false);
      expect(unread.unread).toBe(true);
      expect(new BookmarkRepository(fixture.database).scopeCounts()).toEqual({
        active: 2,
        readLater: 1,
        archived: 0,
      });
    });
  });

  it("atomically marks read and unread without changing favorite or archive state", async () => {
    await withTestDatabase((fixture) => {
      const created = createBookmark(fixture, { id: 1, favorite: true });
      const repository = new BookmarkRepository(fixture.database);
      const service = new BookmarkStateService(repository, () => new Date(SECOND_TIME));

      const markedUnread = service.setUnread(created.id, true);
      expect(markedUnread).toMatchObject({
        id: created.id,
        favorite: true,
        unread: true,
        archived: false,
        updatedAt: SECOND_TIME,
      });
      expect(repository.scopeCounts().readLater).toBe(1);

      const markedRead = service.setUnread(created.id, false);
      expect(markedRead).toMatchObject({
        id: created.id,
        favorite: true,
        unread: false,
        archived: false,
      });
      expect(repository.scopeCounts().readLater).toBe(0);
    });
  });

  it("does not refresh updatedAt for an idempotent reading-state request", async () => {
    await withTestDatabase((fixture) => {
      const created = createBookmark(fixture, { id: 1, unread: true });
      const service = new BookmarkStateService(
        new BookmarkRepository(fixture.database),
        () => new Date(SECOND_TIME),
      );

      expect(service.setUnread(created.id, true).updatedAt).toBe(FIRST_TIME);
    });
  });

  it("reports a missing bookmark without modifying another bookmark", async () => {
    await withTestDatabase((fixture) => {
      const existing = createBookmark(fixture, { id: 1, unread: true });
      const repository = new BookmarkRepository(fixture.database);
      const service = new BookmarkStateService(repository, () => new Date(SECOND_TIME));

      expect(() => service.setUnread(existing.id + 100, false)).toThrow(BookmarkNotFoundError);
      expect(repository.get(existing.id)).toMatchObject({ unread: true, updatedAt: FIRST_TIME });
    });
  });

  it("defines Read Later as active and unread while archive retains reading/favorite state", async () => {
    await withTestDatabase((fixture) => {
      const retained = createBookmark(fixture, { id: 1, favorite: true, unread: true });
      createBookmark(fixture, { id: 2, unread: true });
      createBookmark(fixture, { id: 3 });
      const repository = new BookmarkRepository(fixture.database);

      expect(repository.scopeCounts()).toEqual({ active: 3, readLater: 2, archived: 0 });

      fixture.database
        .prepare("UPDATE bookmarks SET archived_at = ?, updated_at = ? WHERE id = ?")
        .run(SECOND_TIME, SECOND_TIME, retained.id);
      expect(repository.get(retained.id)).toMatchObject({
        favorite: true,
        unread: true,
        archived: true,
      });
      expect(repository.scopeCounts()).toEqual({ active: 2, readLater: 1, archived: 1 });

      fixture.database
        .prepare("UPDATE bookmarks SET archived_at = NULL, updated_at = ? WHERE id = ?")
        .run(SECOND_TIME, retained.id);
      expect(repository.get(retained.id)).toMatchObject({
        favorite: true,
        unread: true,
        archived: false,
      });
      expect(repository.scopeCounts()).toEqual({ active: 3, readLater: 2, archived: 0 });
    });
  });
});

describe("Read Later HTTP behavior", () => {
  it("defaults capture to read and honors an explicit Read Later choice", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const read = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/already-read" },
      });
      const unread = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/read-this", unread: true },
      });

      expect(read.statusCode).toBe(201);
      expect(read.json()).toMatchObject({ unread: false });
      expect(unread.statusCode).toBe(201);
      expect(unread.json()).toMatchObject({ unread: true });
    });
  });

  it("lists Read Later as exactly active and unread", async () => {
    await withFastifyTestHarness(async ({ injectJson, testDatabase }) => {
      const activeUnread = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/active-unread", unread: true },
      });
      await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/active-read" },
      });
      const archivedUnread = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/archived-unread", unread: true },
      });
      testDatabase.database
        .prepare("UPDATE bookmarks SET archived_at = ? WHERE id = ?")
        .run(SECOND_TIME, archivedUnread.json().id);

      const response = await injectJson({
        method: "GET",
        url: "/api/bookmarks?scope=read_later",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().items.map((bookmark: { id: number }) => bookmark.id)).toEqual([
        activeUnread.json().id,
      ]);
    });
  });

  it("moves bookmarks into and out of the Read Later scope independently of favorite", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const favorite = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/favorite", favorite: true },
      });
      const ordinary = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/ordinary", unread: true },
      });

      const markUnread = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${favorite.json().id}`,
        payload: { unread: true },
      });
      expect(markUnread.statusCode).toBe(200);
      expect(markUnread.json()).toMatchObject({ favorite: true, unread: true, archived: false });

      const listed = await injectJson({
        method: "GET",
        url: "/api/bookmarks?scope=read_later&sort=created_asc",
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().items.map((bookmark: { id: number }) => bookmark.id)).toEqual([
        favorite.json().id,
        ordinary.json().id,
      ]);

      const markRead = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${favorite.json().id}`,
        payload: { unread: false },
      });
      expect(markRead.statusCode).toBe(200);
      expect(markRead.json()).toMatchObject({ favorite: true, unread: false, archived: false });

      const readLater = await injectJson({
        method: "GET",
        url: "/api/bookmarks?scope=read_later",
      });
      const active = await injectJson({ method: "GET", url: "/api/bookmarks?scope=active" });
      expect(readLater.json().items.map((bookmark: { id: number }) => bookmark.id)).toEqual([
        ordinary.json().id,
      ]);
      expect(active.json().items.map((bookmark: { id: number }) => bookmark.id)).toContain(
        favorite.json().id,
      );
    });
  });
});
