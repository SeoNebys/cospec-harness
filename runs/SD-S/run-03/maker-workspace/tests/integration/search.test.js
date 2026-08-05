import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server.js";
import { createBookmarkModel } from "../../src/models/bookmark.js";
import { createDb } from "../../src/db.js";

function buildApp() {
  const model = createBookmarkModel(createDb(":memory:"));
  return createApp({ model, titleFetcher: async () => null });
}

describe("GET /api/bookmarks?q= — Search (User Story 2)", () => {
  let app;
  beforeEach(async () => {
    app = buildApp();
    await request(app).post("/api/bookmarks").send({ url: "https://news.example.com", title: "Daily News", note: "world events" });
    await request(app).post("/api/bookmarks").send({ url: "https://recipes.example.com", title: "Best Pasta", note: "dinner ideas", tags: ["cooking"] });
    await request(app).post("/api/bookmarks").send({ url: "https://docs.example.com", title: "API Docs" });
  });

  it("matches on title", async () => {
    const res = await request(app).get("/api/bookmarks").query({ q: "pasta" });
    expect(res.body.bookmarks.map((b) => b.title)).toEqual(["Best Pasta"]);
  });

  it("matches on url", async () => {
    const res = await request(app).get("/api/bookmarks").query({ q: "news.example" });
    expect(res.body.bookmarks).toHaveLength(1);
    expect(res.body.bookmarks[0].title).toBe("Daily News");
  });

  it("matches on note", async () => {
    const res = await request(app).get("/api/bookmarks").query({ q: "dinner" });
    expect(res.body.bookmarks.map((b) => b.title)).toEqual(["Best Pasta"]);
  });

  it("matches on tag name", async () => {
    const res = await request(app).get("/api/bookmarks").query({ q: "cooking" });
    expect(res.body.bookmarks.map((b) => b.title)).toEqual(["Best Pasta"]);
  });

  it("returns an empty array when nothing matches", async () => {
    const res = await request(app).get("/api/bookmarks").query({ q: "zzz-nope" });
    expect(res.body.bookmarks).toEqual([]);
  });

  it("returns the full list when q is absent", async () => {
    const res = await request(app).get("/api/bookmarks");
    expect(res.body.bookmarks).toHaveLength(3);
  });
});
