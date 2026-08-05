import { describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers.js";

async function create(app: ReturnType<typeof makeTestApp>["app"], url: string) {
  return (
    await app.inject({ method: "POST", url: "/api/bookmarks", payload: { url } })
  ).json();
}

describe("DELETE + restore (undo window)", () => {
  it("soft-deletes, removing the bookmark from the list, then restores it", async () => {
    const { app } = makeTestApp();
    const b = await create(app, "https://example.com");

    const del = await app.inject({ method: "DELETE", url: `/api/bookmarks/${b.id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json().undoToken).toBeTruthy();
    expect(del.json().undoExpiresAt).toBeTruthy();

    const afterDelete = (await app.inject({ url: "/api/bookmarks" })).json();
    expect(afterDelete.total).toBe(0);

    const restore = await app.inject({
      method: "POST",
      url: `/api/bookmarks/${b.id}/restore`,
    });
    expect(restore.statusCode).toBe(200);
    expect(restore.json().id).toBe(b.id);

    const afterRestore = (await app.inject({ url: "/api/bookmarks" })).json();
    expect(afterRestore.total).toBe(1);
  });

  it("404s when deleting an unknown id", async () => {
    const { app } = makeTestApp();
    const res = await app.inject({ method: "DELETE", url: "/api/bookmarks/nope" });
    expect(res.statusCode).toBe(404);
  });

  it("410s when the undo window has elapsed (row purged)", async () => {
    // Undo window of 0ms → the row is purged on the next operation.
    const { app } = makeTestApp({ undoWindowMs: 0 });
    const b = await create(app, "https://example.com");
    await app.inject({ method: "DELETE", url: `/api/bookmarks/${b.id}` });

    const restore = await app.inject({
      method: "POST",
      url: `/api/bookmarks/${b.id}/restore`,
    });
    expect(restore.statusCode).toBe(410);
    expect(restore.json().error).toBe("undo_expired");
  });
});
