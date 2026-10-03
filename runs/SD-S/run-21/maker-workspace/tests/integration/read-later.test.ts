import { describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { BookmarkRepository } from "@/lib/bookmarks/repository";
import { BookmarkService } from "@/lib/bookmarks/service";
describe("read later", () => {
  it("moves independently of favorite state", () => {
    const app = new BookmarkService(new BookmarkRepository(createDb()));
    const item = app.create({
      url: "https://example.com/read",
      title: "Read",
      favorite: true
    });
    expect(
      app.list({
        scope: "to_read",
        sort: "created_desc",
        page: 1,
        pageSize: 24
      }).total
    ).toBe(1);
    const changed = app.update(item.id, { readingStatus: "read" })!;
    expect(changed.favorite).toBe(true);
    expect(
      app.list({
        scope: "to_read",
        sort: "created_desc",
        page: 1,
        pageSize: 24
      }).total
    ).toBe(0);
  });
});
