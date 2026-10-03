import { describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { BookmarkRepository } from "@/lib/bookmarks/repository";
import { BookmarkService } from "@/lib/bookmarks/service";
describe("archive", () => {
  it("hides, retains, and restores all details", () => {
    const app = new BookmarkService(new BookmarkRepository(createDb()));
    const item = app.create({
      url: "https://example.com/archive",
      title: "Archive",
      tags: ["Keep"],
      favorite: true
    });
    expect(app.archive(item.id)?.archived).toBe(true);
    expect(
      app.list({ scope: "active", sort: "created_desc", page: 1, pageSize: 24 })
        .total
    ).toBe(0);
    expect(
      app.list({
        scope: "archived",
        sort: "created_desc",
        page: 1,
        pageSize: 24
      }).items[0].tags[0].name
    ).toBe("Keep");
    expect(app.restore(item.id)?.favorite).toBe(true);
  });
});
