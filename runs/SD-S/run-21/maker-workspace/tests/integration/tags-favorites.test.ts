import { describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { BookmarkRepository } from "@/lib/bookmarks/repository";
import { BookmarkService } from "@/lib/bookmarks/service";
describe("tags and favorites", () => {
  it("canonicalizes tags and removes orphans", () => {
    const app = new BookmarkService(new BookmarkRepository(createDb()));
    const item = app.create({
      url: "https://example.com/t",
      title: "Tagged",
      tags: [" Design ", "design"]
    });
    expect(item.tags).toHaveLength(1);
    expect(app.tags()[0].bookmarkCount).toBe(1);
    app.update(item.id, { tags: [], favorite: true });
    expect(app.tags()).toHaveLength(0);
    expect(
      app.list({
        scope: "favorites",
        sort: "created_desc",
        page: 1,
        pageSize: 24
      }).total
    ).toBe(1);
  });
});
