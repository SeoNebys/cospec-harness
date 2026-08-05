import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server.js";
import { createBookmarkModel } from "../../src/models/bookmark.js";
import { createDb } from "../../src/db.js";

function buildApp() {
  const model = createBookmarkModel(createDb(":memory:"));
  return createApp({ model, titleFetcher: async () => null });
}

describe("Tags & notes (User Story 3)", () => {
  let app;
  beforeEach(() => {
    app = buildApp();
  });

  it("stores tags and a note on create and returns them", async () => {
    const res = await request(app)
      .post("/api/bookmarks")
      .send({ url: "https://a.example.com", title: "A", note: "remember this", tags: ["Reading", "reference"] });
    expect(res.status).toBe(201);
    expect(res.body.bookmark.note).toBe("remember this");
    expect(res.body.bookmark.tags).toEqual(["Reading", "reference"]);
  });

  it("dedupes tags case-insensitively", async () => {
    const res = await request(app)
      .post("/api/bookmarks")
      .send({ url: "https://b.example.com", title: "B", tags: ["news", "News", " news "] });
    expect(res.body.bookmark.tags).toEqual(["news"]);
  });

  it("filters the list by tag", async () => {
    await request(app).post("/api/bookmarks").send({ url: "https://c.example.com", title: "C", tags: ["work"] });
    await request(app).post("/api/bookmarks").send({ url: "https://d.example.com", title: "D", tags: ["home"] });

    const res = await request(app).get("/api/bookmarks").query({ tag: "work" });
    expect(res.body.bookmarks.map((b) => b.title)).toEqual(["C"]);
  });

  it("lists all tags in use via GET /api/tags", async () => {
    await request(app).post("/api/bookmarks").send({ url: "https://e.example.com", title: "E", tags: ["alpha"] });
    await request(app).post("/api/bookmarks").send({ url: "https://f.example.com", title: "F", tags: ["beta"] });

    const res = await request(app).get("/api/tags");
    expect(res.body.tags).toEqual(["alpha", "beta"]);
  });

  it("removing a tag from one bookmark leaves it on others", async () => {
    const one = await request(app).post("/api/bookmarks").send({ url: "https://g.example.com", title: "G", tags: ["shared"] });
    await request(app).post("/api/bookmarks").send({ url: "https://h.example.com", title: "H", tags: ["shared"] });

    // Remove the tag from the first bookmark only.
    await request(app).put(`/api/bookmarks/${one.body.bookmark.id}`).send({ tags: [] });

    const stillTagged = await request(app).get("/api/bookmarks").query({ tag: "shared" });
    expect(stillTagged.body.bookmarks.map((b) => b.title)).toEqual(["H"]);
  });
});
