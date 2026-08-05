import { describe, it, expect } from "vitest";
import { createBookmarkModel } from "../../src/models/bookmark.js";
import { createDb } from "../../src/db.js";

/**
 * SC-002 / SC-003: search and tag filtering stay responsive at ~1,000 bookmarks.
 * Runs directly against the model (no HTTP) to time the query layer itself.
 */
describe("scale — search/filter at ~1,000 bookmarks", () => {
  const model = createBookmarkModel(createDb(":memory:"));

  // Seed 1,000 bookmarks with predictable, searchable content.
  for (let i = 0; i < 1000; i++) {
    model.create({
      url: `https://example.com/page-${i}`,
      title: `Article number ${i}`,
      note: i % 10 === 0 ? "milestone entry" : "",
      tags: [i % 2 === 0 ? "even" : "odd", `bucket-${i % 5}`],
      createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    });
  }

  it("returns a text-search result set within 1 second", () => {
    const start = performance.now();
    const results = model.list({ q: "number 500" });
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((b) => b.title === "Article number 500")).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("returns a tag-filter result set within 1 second", () => {
    const start = performance.now();
    const results = model.list({ tag: "even" });
    const elapsed = performance.now() - start;

    expect(results).toHaveLength(500);
    expect(elapsed).toBeLessThan(1000);
  });
});
