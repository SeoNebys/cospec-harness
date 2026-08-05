import { describe, it, expect, afterEach } from "vitest";
import { makeTestApp, type TestContext } from "../helpers.js";

let ctx: TestContext;
afterEach(async () => ctx?.close());

describe("tags", () => {
  it("assigns tags on create and filters by tag (FR-008, FR-009)", async () => {
    ctx = await makeTestApp();
    await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://a.com", title: "A", tags: ["work", "reading"] },
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://b.com", title: "B", tags: ["reading"] },
    });

    const work = await ctx.app.inject({ url: "/api/bookmarks?tag=work" });
    expect(work.json().bookmarks.map((b: { title: string }) => b.title)).toEqual(["A"]);

    const reading = await ctx.app.inject({ url: "/api/bookmarks?tag=reading" });
    expect(reading.json().bookmarks.map((b: { title: string }) => b.title).sort()).toEqual([
      "A",
      "B",
    ]);
  });

  it("treats tag names case-insensitively", async () => {
    ctx = await makeTestApp();
    await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://a.com", title: "A", tags: ["Work"] },
    });
    await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://b.com", title: "B", tags: ["work"] },
    });
    const tags = (await ctx.app.inject({ url: "/api/tags" })).json().tags;
    expect(tags).toHaveLength(1);
    expect(tags[0].count).toBe(2);
  });

  it("removes a tag from one bookmark without affecting others", async () => {
    ctx = await makeTestApp();
    const a = (
      await ctx.app.inject({
        method: "POST",
        url: "/api/bookmarks",
        payload: { url: "https://a.com", title: "A", tags: ["shared"] },
      })
    ).json().bookmark;
    await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://b.com", title: "B", tags: ["shared"] },
    });

    // Remove the tag from A only (replace its tag set with []).
    await ctx.app.inject({ method: "PATCH", url: `/api/bookmarks/${a.id}`, payload: { tags: [] } });

    const shared = await ctx.app.inject({ url: "/api/bookmarks?tag=shared" });
    expect(shared.json().bookmarks.map((b: { title: string }) => b.title)).toEqual(["B"]);
  });

  it("lists tags with bookmark counts", async () => {
    ctx = await makeTestApp();
    await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://a.com", title: "A", tags: ["x", "y"] },
    });
    const tags = (await ctx.app.inject({ url: "/api/tags" })).json().tags;
    expect(tags.map((t: { name: string }) => t.name).sort()).toEqual(["x", "y"]);
  });
});
