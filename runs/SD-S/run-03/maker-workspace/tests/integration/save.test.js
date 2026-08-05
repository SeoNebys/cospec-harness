import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server.js";
import { createBookmarkModel } from "../../src/models/bookmark.js";
import { createDb } from "../../src/db.js";

function buildApp() {
  const model = createBookmarkModel(createDb(":memory:"));
  // Stub the title fetcher so tests are deterministic and offline.
  const titleFetcher = async (url) => (url.includes("titled") ? "Fetched Title" : null);
  return createApp({ model, titleFetcher });
}

describe("POST /api/bookmarks — Save a bookmark (User Story 1)", () => {
  let app;
  beforeEach(() => {
    app = buildApp();
  });

  it("Scenario 1: saves a valid URL and returns it in the list", async () => {
    const create = await request(app).post("/api/bookmarks").send({ url: "https://example.com", title: "Example" });
    expect(create.status).toBe(201);
    expect(create.body.bookmark).toMatchObject({ url: "https://example.com", title: "Example" });

    const list = await request(app).get("/api/bookmarks");
    expect(list.status).toBe(200);
    expect(list.body.bookmarks).toHaveLength(1);
    expect(list.body.bookmarks[0].title).toBe("Example");
  });

  it("Scenario 2: auto-fetches the title when none is supplied", async () => {
    const res = await request(app).post("/api/bookmarks").send({ url: "https://titled.example.com" });
    expect(res.status).toBe(201);
    expect(res.body.bookmark.title).toBe("Fetched Title");
  });

  it("Scenario 2b: falls back to the URL when no title can be fetched", async () => {
    const res = await request(app).post("/api/bookmarks").send({ url: "https://plain.example.com" });
    expect(res.status).toBe(201);
    expect(res.body.bookmark.title).toBe("https://plain.example.com");
  });

  it("Scenario 4: rejects an invalid URL with 400 and saves nothing", async () => {
    const res = await request(app).post("/api/bookmarks").send({ url: "not a url" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_url");

    const list = await request(app).get("/api/bookmarks");
    expect(list.body.bookmarks).toHaveLength(0);
  });

  it("Edge case: warns on duplicate (409), then saves when confirmed", async () => {
    await request(app).post("/api/bookmarks").send({ url: "https://dup.example.com" });

    const dup = await request(app).post("/api/bookmarks").send({ url: "https://DUP.example.com/" });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("duplicate");
    expect(dup.body.existing).toBeTruthy();

    const confirmed = await request(app)
      .post("/api/bookmarks")
      .send({ url: "https://DUP.example.com/", confirmDuplicate: true });
    expect(confirmed.status).toBe(201);

    const list = await request(app).get("/api/bookmarks");
    expect(list.body.bookmarks).toHaveLength(2);
  });
});

describe("GET /api/bookmarks/:id", () => {
  it("returns 404 for a missing bookmark", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/bookmarks/999");
    expect(res.status).toBe(404);
  });
});
