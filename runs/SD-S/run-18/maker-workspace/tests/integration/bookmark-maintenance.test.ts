import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BookmarkServiceError, createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { createTagRepository } from "~/features/bookmarks/tag.repository.server";
import { createTestDatabase } from "../helpers/database";
import { createTestAuth, testUsers } from "../helpers/auth";

describe("bookmark maintenance", () => {
  let database: ReturnType<typeof createTestDatabase>;
  beforeEach(async () => { database = createTestDatabase(); await createTestAuth(database.db); });
  afterEach(() => database.cleanup());

  it("updates all fields atomically and rolls back duplicate URLs", async () => {
    const alice = await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.alice.email) });
    const service = createBookmarkService(database.db);
    const first = service.create(alice!.id, { url: "https://example.com/first", title: "First", description: null, tags: ["Old"] });
    const second = service.create(alice!.id, { url: "https://example.com/second", title: "Second", description: null, tags: [] });
    const updated = service.update(alice!.id, first.id, { url: "https://example.com/updated", title: "Updated", description: "New description", tags: ["New"] });
    expect(updated).toMatchObject({ title: "Updated", description: "New description" });
    expect(updated.tags.map((tag) => tag.name)).toEqual(["New"]);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(first.updatedAt).getTime());
    expect(() => service.update(alice!.id, first.id, { url: second.url, title: "Should roll back", description: null, tags: ["Bad"] })).toThrow(BookmarkServiceError);
    expect(service.get(alice!.id, first.id).title).toBe("Updated");
  });

  it("obscures foreign IDs and deletes associations plus orphan tags", async () => {
    const alice = await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.alice.email) });
    const bob = await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.bob.email) });
    const service = createBookmarkService(database.db);
    const saved = service.create(alice!.id, { url: "https://example.com/delete", title: "Delete", description: null, tags: ["Temporary"] });
    expect(() => service.delete(bob!.id, saved.id)).toThrowError("BOOKMARK_NOT_FOUND");
    expect(service.get(alice!.id, saved.id).title).toBe("Delete");
    service.delete(alice!.id, saved.id);
    expect(() => service.get(alice!.id, saved.id)).toThrowError("BOOKMARK_NOT_FOUND");
    expect(createTagRepository(database.db).listWithCounts(alice!.id)).toEqual([]);
  });
});
