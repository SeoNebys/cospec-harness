import { describe, it, expect, afterEach } from "vitest";
import { makeTestApp, type TestContext } from "../helpers.js";

let ctx: TestContext;
afterEach(async () => ctx?.close());

async function seed(ctx: TestContext) {
  // Distinct created_at values so ordering is deterministic.
  let n = 0;
  const svc = ctx.services.bookmarkService;
  // Access the private clock indirectly by inserting with increasing time via now override is not set here;
  // instead rely on insertion order (id DESC as tiebreaker) — create in sequence.
  const a = svc.create({ url: "https://a.com", title: "Cooking recipes" });
  n++;
  const b = svc.create({ url: "https://b.com", title: "TypeScript handbook" });
  n++;
  const c = svc.create({ url: "https://c.com", title: "Travel guide", note: "recipes for the trip" });
  return { a, b, c, n };
}

describe("GET /api/bookmarks (list, search, order)", () => {
  it("lists all bookmarks newest-first (FR-005)", async () => {
    ctx = await makeTestApp();
    await seed(ctx);
    const res = await ctx.app.inject({ url: "/api/bookmarks" });
    const titles = res.json().bookmarks.map((b: { title: string }) => b.title);
    expect(titles).toEqual(["Travel guide", "TypeScript handbook", "Cooking recipes"]);
  });

  it("returns only bookmarks matching a search term in the title (FR-006)", async () => {
    ctx = await makeTestApp();
    await seed(ctx);
    const res = await ctx.app.inject({ url: "/api/bookmarks?q=typescript" });
    const urls = res.json().bookmarks.map((b: { url: string }) => b.url);
    expect(urls).toEqual(["https://b.com"]);
  });

  it("matches terms in the note as well (FR-006)", async () => {
    ctx = await makeTestApp();
    await seed(ctx);
    const res = await ctx.app.inject({ url: "/api/bookmarks?q=recipes" });
    const urls = res.json().bookmarks.map((b: { url: string }) => b.url).sort();
    // "Cooking recipes" (title) and "recipes for the trip" (note)
    expect(urls).toEqual(["https://a.com", "https://c.com"]);
  });

  it("supports prefix matching", async () => {
    ctx = await makeTestApp();
    await seed(ctx);
    const res = await ctx.app.inject({ url: "/api/bookmarks?q=cook" });
    expect(res.json().bookmarks).toHaveLength(1);
  });

  it("returns an empty list for a non-matching search (FR-007)", async () => {
    ctx = await makeTestApp();
    await seed(ctx);
    const res = await ctx.app.inject({ url: "/api/bookmarks?q=zzzznotfound" });
    expect(res.json().bookmarks).toEqual([]);
  });
});
