import { describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers.js";

async function seed(app: ReturnType<typeof makeTestApp>["app"], url: string, title?: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/bookmarks",
    payload: { url, title },
  });
  return res.json();
}

describe("GET /api/bookmarks", () => {
  it("returns an empty collection shape when nothing is saved", async () => {
    const { app } = makeTestApp();
    const res = await app.inject({ method: "GET", url: "/api/bookmarks" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], total: 0 });
  });

  it("lists saved bookmarks newest-first by default", async () => {
    const { app } = makeTestApp();
    await seed(app, "https://a.example.com", "A");
    await seed(app, "https://b.example.com", "B");
    const res = await app.inject({ method: "GET", url: "/api/bookmarks" });
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.items.map((b: { title: string }) => b.title)).toEqual(["B", "A"]);
  });

  it("fetches a single bookmark by id and 404s for unknown ids", async () => {
    const { app } = makeTestApp();
    const created = await seed(app, "https://one.example.com", "One");
    const ok = await app.inject({
      method: "GET",
      url: `/api/bookmarks/${created.id}`,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().title).toBe("One");

    const missing = await app.inject({
      method: "GET",
      url: "/api/bookmarks/does-not-exist",
    });
    expect(missing.statusCode).toBe(404);
  });
});
