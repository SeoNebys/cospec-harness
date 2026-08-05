import { describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers.js";

async function create(app: ReturnType<typeof makeTestApp>["app"], url: string, title: string) {
  return (
    await app.inject({ method: "POST", url: "/api/bookmarks", payload: { url, title } })
  ).json();
}

describe("PUT /api/bookmarks/:id", () => {
  it("updates title and tags and refreshes updatedAt", async () => {
    const { app } = makeTestApp();
    const b = await create(app, "https://example.com", "Old");
    const res = await app.inject({
      method: "PUT",
      url: `/api/bookmarks/${b.id}`,
      payload: { title: "New", tags: ["x"] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe("New");
    expect(body.tags).toEqual(["x"]);
    expect(body.updatedAt >= b.updatedAt).toBe(true);
  });

  it("400s on invalid url change", async () => {
    const { app } = makeTestApp();
    const b = await create(app, "https://example.com", "T");
    const res = await app.inject({
      method: "PUT",
      url: `/api/bookmarks/${b.id}`,
      payload: { url: "nonsense" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_url");
  });

  it("404s for an unknown id", async () => {
    const { app } = makeTestApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/bookmarks/nope",
      payload: { title: "x" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("409s when a url change collides with another bookmark", async () => {
    const { app } = makeTestApp();
    await create(app, "https://taken.example.com", "Taken");
    const b = await create(app, "https://free.example.com", "Free");
    const res = await app.inject({
      method: "PUT",
      url: `/api/bookmarks/${b.id}`,
      payload: { url: "https://taken.example.com" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("duplicate");
    expect(res.json().existing.title).toBe("Taken");
  });
});
