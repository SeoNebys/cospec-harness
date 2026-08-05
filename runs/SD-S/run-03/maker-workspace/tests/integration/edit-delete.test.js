import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server.js";
import { createBookmarkModel } from "../../src/models/bookmark.js";
import { createDb } from "../../src/db.js";

function buildApp() {
  const model = createBookmarkModel(createDb(":memory:"));
  return createApp({ model, titleFetcher: async () => null });
}

describe("Edit & delete (User Story 4)", () => {
  let app;
  let id;
  beforeEach(async () => {
    app = buildApp();
    const created = await request(app)
      .post("/api/bookmarks")
      .send({ url: "https://edit.example.com", title: "Original", note: "n", tags: ["x"] });
    id = created.body.bookmark.id;
  });

  it("updates title, url, note, and tags", async () => {
    const res = await request(app)
      .put(`/api/bookmarks/${id}`)
      .send({ title: "Updated", url: "https://updated.example.com", note: "n2", tags: ["y", "z"] });
    expect(res.status).toBe(200);
    expect(res.body.bookmark).toMatchObject({
      title: "Updated",
      url: "https://updated.example.com",
      note: "n2",
    });
    expect(res.body.bookmark.tags).toEqual(["y", "z"]);
  });

  it("persists an edit (visible on subsequent GET)", async () => {
    await request(app).put(`/api/bookmarks/${id}`).send({ title: "Persisted" });
    const res = await request(app).get(`/api/bookmarks/${id}`);
    expect(res.body.bookmark.title).toBe("Persisted");
  });

  it("rejects an invalid URL on update with 400", async () => {
    const res = await request(app).put(`/api/bookmarks/${id}`).send({ url: "not a url" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_url");
  });

  it("returns 404 when updating a missing bookmark", async () => {
    const res = await request(app).put(`/api/bookmarks/9999`).send({ title: "x" });
    expect(res.status).toBe(404);
  });

  it("deletes a bookmark (204) and it disappears from the list", async () => {
    const del = await request(app).delete(`/api/bookmarks/${id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get("/api/bookmarks");
    expect(list.body.bookmarks).toHaveLength(0);
  });

  it("returns 404 when deleting a missing bookmark", async () => {
    const res = await request(app).delete(`/api/bookmarks/9999`);
    expect(res.status).toBe(404);
  });
});
