import { describe, it, expect } from "vitest";
import { createDatabase } from "../../src/db/connection.js";
import { createServices } from "../../src/app.js";

// Deterministic clock so created_at ordering is unambiguous.
function makeClock() {
  let n = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0) + n++ * 1000).toISOString();
}

describe("performance & ordering at scale (SC-003)", () => {
  it("searches 1,000 bookmarks well under 1 second and returns newest-first", () => {
    const db = createDatabase(":memory:");
    const { bookmarkService } = createServices({
      db,
      fetchMetadata: async () => ({ title: null, description: null, imageUrl: null }),
      now: makeClock(),
    });

    for (let i = 0; i < 1000; i++) {
      bookmarkService.create({
        url: `https://example.com/item-${i}`,
        title: i % 10 === 0 ? `Special report ${i}` : `Article number ${i}`,
      });
    }

    const start = performance.now();
    const results = bookmarkService.list({ q: "special" });
    const elapsed = performance.now() - start;

    expect(results.length).toBe(100);
    expect(elapsed).toBeLessThan(1000);

    // Newest-first: the highest-numbered special report comes first.
    expect(results[0].title).toBe("Special report 990");

    // Full-list ordering is newest-first too (FR-005).
    const all = bookmarkService.list({});
    expect(all[0].url).toBe("https://example.com/item-999");
    expect(all[all.length - 1].url).toBe("https://example.com/item-0");

    db.close();
  });
});
