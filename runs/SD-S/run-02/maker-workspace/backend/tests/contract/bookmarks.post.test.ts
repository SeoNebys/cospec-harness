import { describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers.js";

describe("POST /api/bookmarks", () => {
  it("creates a bookmark (201) and derives a title when omitted", async () => {
    const { app } = makeTestApp({ deriveTitle: async () => "Derived Title" });
    const res = await app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://example.com/a", tags: ["Tech", "tech"] },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe("Derived Title");
    expect(body.url).toBe("https://example.com/a");
    expect(body.tags).toEqual(["tech"]);
    expect(body.id).toBeTruthy();
    expect(body.createdAt).toBeTruthy();
    // internal fields not leaked
    expect(body.normalizedUrl).toBeUndefined();
    expect(body.deletedAt).toBeUndefined();
  });

  it("falls back to the URL when no title can be derived", async () => {
    const { app } = makeTestApp({ deriveTitle: async () => null });
    const res = await app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://example.com/no-title" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().title).toBe("https://example.com/no-title");
  });

  it("honors a user-supplied title over derivation", async () => {
    const { app } = makeTestApp({ deriveTitle: async () => "Ignored" });
    const res = await app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://example.com", title: "My Title" },
    });
    expect(res.json().title).toBe("My Title");
  });

  it("rejects an invalid URL with 400 invalid_url", async () => {
    const { app } = makeTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "not-a-url" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_url");
    expect(res.json().message).toBeTruthy();
  });
});
