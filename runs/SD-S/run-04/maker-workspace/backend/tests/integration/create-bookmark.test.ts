import { describe, it, expect, afterEach } from "vitest";
import { makeTestApp, type TestContext } from "../helpers.js";

let ctx: TestContext;
afterEach(async () => ctx?.close());

describe("POST /api/bookmarks", () => {
  it("creates a bookmark immediately with pending fetch status (FR-017)", async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://example.com/a" },
    });
    expect(res.statusCode).toBe(201);
    const { bookmark } = res.json();
    expect(bookmark.url).toBe("https://example.com/a");
    expect(bookmark.fetchStatus).toBe("pending");
    expect(bookmark.id).toBeGreaterThan(0);
  });

  it("rejects a malformed URL with 400 (FR-002)", async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "not-a-url" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_INPUT");
  });

  it("warns on a duplicate with 409 and returns the existing bookmark (FR-012)", async () => {
    ctx = await makeTestApp();
    await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://example.com/dup" },
    });
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://example.com/dup/?utm_source=x" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("DUPLICATE_BOOKMARK");
    expect(res.json().error.details.existing.url).toBe("https://example.com/dup");
  });

  it("allows a duplicate when allowDuplicate is true", async () => {
    ctx = await makeTestApp();
    const payload = { url: "https://example.com/dup2" };
    await ctx.app.inject({ method: "POST", url: "/api/bookmarks", payload });
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { ...payload, allowDuplicate: true },
    });
    expect(res.statusCode).toBe(201);
  });

  it("enriches with fetched title and preview on success (FR-014)", async () => {
    ctx = await makeTestApp({
      title: "Fetched Title",
      description: "A summary",
      imageUrl: "https://cdn/x.png",
    });
    const created = (
      await ctx.app.inject({
        method: "POST",
        url: "/api/bookmarks",
        payload: { url: "https://example.com/enrich" },
      })
    ).json().bookmark;

    await ctx.services.bookmarkService.enrich(created.id);

    const after = (await ctx.app.inject({ url: `/api/bookmarks/${created.id}` })).json().bookmark;
    expect(after.title).toBe("Fetched Title");
    expect(after.previewDescription).toBe("A summary");
    expect(after.previewImageUrl).toBe("https://cdn/x.png");
    expect(after.fetchStatus).toBe("success");
  });

  it("keeps a user-provided title over the fetched one (FR-015)", async () => {
    ctx = await makeTestApp({ title: "Fetched Title", description: "d" });
    const created = (
      await ctx.app.inject({
        method: "POST",
        url: "/api/bookmarks",
        payload: { url: "https://example.com/mine", title: "My Title" },
      })
    ).json().bookmark;

    await ctx.services.bookmarkService.enrich(created.id);

    const after = (await ctx.app.inject({ url: `/api/bookmarks/${created.id}` })).json().bookmark;
    expect(after.title).toBe("My Title");
    expect(after.previewDescription).toBe("d");
  });

  it("marks fetch failed and keeps the address as fallback when no metadata (FR-016)", async () => {
    ctx = await makeTestApp(); // stub returns all nulls
    const created = (
      await ctx.app.inject({
        method: "POST",
        url: "/api/bookmarks",
        payload: { url: "https://unreachable.example/x" },
      })
    ).json().bookmark;

    await ctx.services.bookmarkService.enrich(created.id);

    const after = (await ctx.app.inject({ url: `/api/bookmarks/${created.id}` })).json().bookmark;
    expect(after.title).toBeNull();
    expect(after.fetchStatus).toBe("failed");
    expect(after.url).toBe("https://unreachable.example/x");
  });
});
