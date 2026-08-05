import { describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers.js";

async function seed(
  app: ReturnType<typeof makeTestApp>["app"],
  url: string,
  title: string,
  tags: string[] = [],
) {
  await app.inject({
    method: "POST",
    url: "/api/bookmarks",
    payload: { url, title, tags },
  });
}

describe("GET /api/bookmarks (search & filter) and GET /api/tags", () => {
  it("searches title, url, and tags case-insensitively", async () => {
    const { app } = makeTestApp();
    await seed(app, "https://reactjs.org", "React Docs", ["frontend"]);
    await seed(app, "https://nodejs.org", "Node Runtime", ["backend"]);

    const byTitle = (await app.inject({ url: "/api/bookmarks?q=react" })).json();
    expect(byTitle.items.map((b: { title: string }) => b.title)).toEqual([
      "React Docs",
    ]);

    const byTag = (await app.inject({ url: "/api/bookmarks?q=BACKEND" })).json();
    expect(byTag.items.map((b: { title: string }) => b.title)).toEqual([
      "Node Runtime",
    ]);
  });

  it("filters by tag", async () => {
    const { app } = makeTestApp();
    await seed(app, "https://a.example.com", "A", ["tech", "reading"]);
    await seed(app, "https://b.example.com", "B", ["reading"]);
    await seed(app, "https://c.example.com", "C", ["cooking"]);

    const reading = (await app.inject({ url: "/api/bookmarks?tag=reading" })).json();
    expect(reading.total).toBe(2);
    expect(reading.items.map((b: { title: string }) => b.title).sort()).toEqual([
      "A",
      "B",
    ]);
  });

  it("lists tags with counts", async () => {
    const { app } = makeTestApp();
    await seed(app, "https://a.example.com", "A", ["tech", "reading"]);
    await seed(app, "https://b.example.com", "B", ["reading"]);
    const res = await app.inject({ url: "/api/tags" });
    expect(res.statusCode).toBe(200);
    const { tags } = res.json();
    expect(tags).toContainEqual({ name: "reading", count: 2 });
    expect(tags).toContainEqual({ name: "tech", count: 1 });
  });
});
