import { describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { BookmarkRepository } from "@/lib/bookmarks/repository";
import { BookmarkService } from "@/lib/bookmarks/service";
describe("bookmark discovery", () => {
  it("combines search, tags, state, and sorting", () => {
    const app = new BookmarkService(new BookmarkRepository(createDb()));
    app.create({
      url: "https://example.com/a",
      title: "Zebra",
      description: "Typography notes",
      tags: ["Design"]
    });
    app.create({
      url: "https://example.com/b",
      title: "Apple",
      description: "Other",
      tags: ["Work"],
      readingStatus: "read"
    });
    const result = app.list({
      scope: "active",
      q: "typography",
      tag: "design",
      readingStatus: "to_read",
      sort: "title_asc",
      page: 1,
      pageSize: 24
    });
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe("Zebra");
  });
});
