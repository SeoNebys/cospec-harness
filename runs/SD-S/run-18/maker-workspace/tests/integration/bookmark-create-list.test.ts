import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { createTestDatabase } from "../helpers/database";
import { createTestAuth, testUsers } from "../helpers/auth";

describe("bookmark create and list", () => {
  let database: ReturnType<typeof createTestDatabase>;
  beforeEach(async () => { database = createTestDatabase(); await createTestAuth(database.db); });
  afterEach(() => database.cleanup());

  it("persists newest-first bookmarks and isolates owners", async () => {
    const service = createBookmarkService(database.db);
    const alice = (await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.alice.email) }))!;
    const bob = (await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.bob.email) }))!;
    await service.create(alice.id, { url: "https://example.com/one", title: "One", description: null, tags: [] });
    await service.create(alice.id, { url: "https://example.com/two", title: "Two", description: null, tags: [] });
    expect((await service.list(alice.id, {})).items.map((item) => item.title)).toEqual(["Two", "One"]);
    expect((await service.list(bob.id, {})).items).toEqual([]);
  });

  it("rejects a normalized duplicate per owner but allows it for another owner", async () => {
    const service = createBookmarkService(database.db);
    const alice = (await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.alice.email) }))!;
    const bob = (await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.bob.email) }))!;
    await service.create(alice.id, { url: "https://EXAMPLE.com:443/a#x", title: "One", description: null, tags: [] });
    expect(() => service.create(alice.id, { url: "https://example.com/a", title: "Again", description: null, tags: [] })).toThrow(expect.objectContaining({ code: "DUPLICATE_BOOKMARK" }));
    expect(service.create(bob.id, { url: "https://example.com/a", title: "Bob", description: null, tags: [] })).toMatchObject({ title: "Bob" });
  });
});
