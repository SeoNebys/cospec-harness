import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { createTestDatabase } from "../helpers/database";
import { createTestAuth, testUsers } from "../helpers/auth";

describe("bookmark search", () => {
  let database: ReturnType<typeof createTestDatabase>;
  beforeEach(async () => { database = createTestDatabase(); await createTestAuth(database.db); });
  afterEach(() => database.cleanup());

  it("searches all supported fields, combines an exact tag, and scopes by owner", async () => {
    const [alice, bob] = await Promise.all(Object.values(testUsers).map((item) => database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, item.email) })));
    const service = createBookmarkService(database.db);
    service.create(alice!.id, { url: "https://example.com/needle", title: "Garden notes", description: "Perennial guide", tags: ["Research"] });
    service.create(alice!.id, { url: "https://other.test/path", title: "Needle title", description: null, tags: ["Later"] });
    service.create(bob!.id, { url: "https://private.test", title: "Needle private", description: null, tags: ["Research"] });
    expect(service.list(alice!.id, { query: "NEEDLE", limit: 50 }).items).toHaveLength(2);
    expect(service.list(alice!.id, { query: "perennial", tag: "research", limit: 50 }).items.map((item) => item.title)).toEqual(["Garden notes"]);
    expect(service.list(alice!.id, { query: "%", limit: 50 }).items).toHaveLength(0);
  });

  it("returns opaque cursor pages in stable order", async () => {
    const alice = await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.alice.email) });
    const service = createBookmarkService(database.db);
    for (let index = 0; index < 3; index++) service.create(alice!.id, { url: `https://example.com/${index}`, title: `Item ${index}`, description: null, tags: [] });
    const first = service.list(alice!.id, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    expect(service.list(alice!.id, { limit: 2, cursor: first.nextCursor }).items).toHaveLength(1);
  });
});
