import { describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers.js";

describe("search + tag filter combined (AND)", () => {
  it("returns only bookmarks matching both the query and every tag", async () => {
    const { service } = makeTestApp();
    await service.create({ url: "https://a.example.com", title: "Rust guide", tags: ["lang", "systems"] });
    await service.create({ url: "https://b.example.com", title: "Rust cooking", tags: ["cooking"] });
    await service.create({ url: "https://c.example.com", title: "Go guide", tags: ["lang"] });

    const result = service.list({
      q: "guide",
      tag: ["lang", "systems"],
      sort: "recent",
      limit: 100,
      offset: 0,
    });

    expect(result.items.map((b) => b.title)).toEqual(["Rust guide"]);
  });

  it("paginates with limit/offset while reporting the full total", async () => {
    const { service } = makeTestApp();
    for (let i = 0; i < 5; i++) {
      await service.create({ url: `https://x${i}.example.com`, title: `T${i}` });
    }
    const page = service.list({ sort: "recent", limit: 2, offset: 0, q: undefined, tag: undefined });
    expect(page.total).toBe(5);
    expect(page.items).toHaveLength(2);
  });
});
