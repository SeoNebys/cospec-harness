import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { createTagRepository } from "~/features/bookmarks/tag.repository.server";
import { createTestDatabase } from "../helpers/database";
import { createTestAuth, testUsers } from "../helpers/auth";

describe("bookmark tags", () => {
  let database: ReturnType<typeof createTestDatabase>;
  beforeEach(async () => { database = createTestDatabase(); await createTestAuth(database.db); });
  afterEach(() => database.cleanup());

  it("normalizes, reuses, replaces, and cleans owner tags", async () => {
    const alice = (await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.alice.email) }))!;
    const service = createBookmarkService(database.db);
    const first = service.create(alice.id, { url: "https://example.com/tags-one", title: "One", description: null, tags: [" Design ", "READING"] });
    const second = service.create(alice.id, { url: "https://example.com/tags-two", title: "Two", description: null, tags: ["design"] });
    expect(first.tags.map((tag) => tag.name)).toEqual(["Design", "READING"]);
    expect(second.tags[0]?.id).toBe(first.tags[0]?.id);
    const tags = createTagRepository(database.db);
    tags.replace(alice.id, first.id, ["Reading"]);
    expect(tags.listForBookmark(alice.id, first.id).map((tag) => tag.name)).toEqual(["READING"]);
    expect(tags.listWithCounts(alice.id).map((tag) => [tag.name, tag.bookmarkCount])).toEqual([["Design", 1], ["READING", 1]]);
  });

  it("enforces 50 characters and 20 unique tags", async () => {
    const alice = (await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.alice.email) }))!;
    const service = createBookmarkService(database.db);
    expect(() => service.create(alice.id, { url: "https://example.com/many", title: "Many", description: null, tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) })).toThrow();
    expect(() => service.create(alice.id, { url: "https://example.com/long", title: "Long", description: null, tags: ["x".repeat(51)] })).toThrow();
  });
});
