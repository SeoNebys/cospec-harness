import { afterEach, describe, expect, it } from "vitest";
import { createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { user, bookmark } from "~/db/schema";
import { createTestDatabase } from "../helpers/database";

describe("bookmark scale", () => {
  const databases: ReturnType<typeof createTestDatabase>[] = [];
  afterEach(() => databases.splice(0).forEach((database) => database.cleanup()));
  it("lists and searches a 1,000-bookmark library within two seconds", () => {
    const database = createTestDatabase(); databases.push(database);
    const now = new Date();
    database.db.insert(user).values({ id: "scale-user", name: "Scale", email: "scale@example.test", emailVerified: true, createdAt: now, updatedAt: now }).run();
    database.db.insert(bookmark).values(Array.from({ length: 1000 }, (_, index) => ({ id: `b-${String(index).padStart(4, "0")}`, ownerId: "scale-user", url: `https://example.com/${index}`, normalizedUrl: `https://example.com/${index}`, title: index === 777 ? "Known needle" : `Bookmark ${index}`, description: `Description ${index}`, createdAt: new Date(now.getTime() + index), updatedAt: now }))).run();
    const service = createBookmarkService(database.db);
    const started = performance.now();
    expect(service.list("scale-user", { limit: 50 }).items).toHaveLength(50);
    expect(service.list("scale-user", { query: "known needle", limit: 50 }).items[0]?.title).toBe("Known needle");
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
