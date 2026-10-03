import { describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { BookmarkRepository } from "@/lib/bookmarks/repository";
describe("query performance", () => {
  it("queries a representative library promptly", () => {
    const repo = new BookmarkRepository(createDb());
    for (let i = 0; i < 500; i++)
      repo.create({
        url: `https://example.com/${i}`,
        normalizedUrl: `https://example.com/${i}`,
        title: `Bookmark ${i}`,
        tags: [i % 2 ? "odd" : "even"]
      });
    const start = performance.now();
    const result = repo.list({
      scope: "active",
      q: "Bookmark",
      tag: "even",
      sort: "created_desc",
      page: 1,
      pageSize: 24
    });
    expect(result.total).toBe(250);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
