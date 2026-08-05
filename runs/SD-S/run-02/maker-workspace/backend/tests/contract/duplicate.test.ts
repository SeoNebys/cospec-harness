import { describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers.js";

describe("duplicate detection (409)", () => {
  it("warns instead of silently duplicating an existing address", async () => {
    const { app } = makeTestApp();
    const first = await app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://example.com/page", title: "First" },
    });
    expect(first.statusCode).toBe(201);

    // Same page, spelled differently (trailing slash + host case).
    const dup = await app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://EXAMPLE.com/page/", title: "Second" },
    });
    expect(dup.statusCode).toBe(409);
    const body = dup.json();
    expect(body.error).toBe("duplicate");
    expect(body.existing.title).toBe("First");
  });

  it("allows re-saving an address after it was deleted", async () => {
    const { app } = makeTestApp();
    const created = (
      await app.inject({
        method: "POST",
        url: "/api/bookmarks",
        payload: { url: "https://example.com/x" },
      })
    ).json();
    await app.inject({ method: "DELETE", url: `/api/bookmarks/${created.id}` });

    const again = await app.inject({
      method: "POST",
      url: "/api/bookmarks",
      payload: { url: "https://example.com/x" },
    });
    expect(again.statusCode).toBe(201);
  });
});
