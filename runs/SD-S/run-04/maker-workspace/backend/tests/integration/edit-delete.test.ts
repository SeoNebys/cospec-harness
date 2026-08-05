import { describe, it, expect, afterEach } from "vitest";
import { makeTestApp, type TestContext } from "../helpers.js";

let ctx: TestContext;
afterEach(async () => ctx?.close());

async function create(ctx: TestContext, payload: Record<string, unknown>) {
  return (await ctx.app.inject({ method: "POST", url: "/api/bookmarks", payload })).json().bookmark;
}

describe("PATCH /api/bookmarks/:id", () => {
  it("edits title and note and persists them (FR-010)", async () => {
    ctx = await makeTestApp();
    const b = await create(ctx, { url: "https://a.com", title: "Old" });

    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/bookmarks/${b.id}`,
      payload: { title: "New title", note: "a note" },
    });
    expect(res.statusCode).toBe(200);

    const after = (await ctx.app.inject({ url: `/api/bookmarks/${b.id}` })).json().bookmark;
    expect(after.title).toBe("New title");
    expect(after.note).toBe("a note");
  });

  it("a user title survives a later enrichment (FR-015)", async () => {
    ctx = await makeTestApp({ title: "Fetched" });
    const b = await create(ctx, { url: "https://a.com" });
    await ctx.app.inject({ method: "PATCH", url: `/api/bookmarks/${b.id}`, payload: { title: "Mine" } });
    await ctx.services.bookmarkService.enrich(b.id);
    const after = (await ctx.app.inject({ url: `/api/bookmarks/${b.id}` })).json().bookmark;
    expect(after.title).toBe("Mine");
  });

  it("returns 404 for a missing bookmark", async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/bookmarks/9999",
      payload: { title: "x" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/bookmarks/:id", () => {
  it("deletes a bookmark (FR-011)", async () => {
    ctx = await makeTestApp();
    const b = await create(ctx, { url: "https://a.com", title: "A" });
    const del = await ctx.app.inject({ method: "DELETE", url: `/api/bookmarks/${b.id}` });
    expect(del.statusCode).toBe(204);

    const after = await ctx.app.inject({ url: `/api/bookmarks/${b.id}` });
    expect(after.statusCode).toBe(404);
    const list = await ctx.app.inject({ url: "/api/bookmarks" });
    expect(list.json().bookmarks).toHaveLength(0);
  });

  it("returns 404 when deleting a missing bookmark", async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: "DELETE", url: "/api/bookmarks/9999" });
    expect(res.statusCode).toBe(404);
  });

  it("removing a bookmark also removes its tag links", async () => {
    ctx = await makeTestApp();
    const b = await create(ctx, { url: "https://a.com", title: "A", tags: ["solo"] });
    await ctx.app.inject({ method: "DELETE", url: `/api/bookmarks/${b.id}` });
    const tags = (await ctx.app.inject({ url: "/api/tags" })).json().tags;
    // The tag row may remain but must have a zero count.
    const solo = tags.find((t: { name: string }) => t.name === "solo");
    expect(solo?.count ?? 0).toBe(0);
  });
});
