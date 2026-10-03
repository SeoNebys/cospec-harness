import { BookmarkRepository } from "../../src/server/repositories/bookmark-repository.js";
import { IconRepository } from "../../src/server/repositories/icon-repository.js";
import { SearchRepository } from "../../src/server/repositories/search-repository.js";
import {
  computeCriteriaHash,
  SelectionRepository,
} from "../../src/server/repositories/selection-repository.js";
import { withFastifyTestHarness } from "../helpers/fastify.js";

const NOW = "2026-09-17T12:00:00.000Z";

describe("bookmark edit and permanent deletion", () => {
  it("rolls back invalid and duplicate edits without changing any companion field", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const first = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/edit-source", title: "Original", favorite: true },
      });
      const duplicate = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/edit-target" },
      });

      const invalid = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${first.json().id}`,
        payload: { address: "not a url", title: "Must not apply", favorite: false },
      });
      expect(invalid.statusCode).toBe(422);

      const conflict = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${first.json().id}`,
        payload: {
          address: "https://EXAMPLE.com:443/edit-target",
          title: "Also must not apply",
          favorite: false,
        },
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().existingBookmarkId).toBe(duplicate.json().id);
      expect(
        (await injectJson({ method: "GET", url: `/api/bookmarks/${first.json().id}` })).json(),
      ).toMatchObject({
        address: "https://example.com/edit-source",
        title: "Original",
        favorite: true,
      });
    });
  });

  it("deletes FTS, tag, and selection membership and disappears from live results", async () => {
    await withFastifyTestHarness(async ({ injectJson, testDatabase }) => {
      const doomed = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: {
          address: "https://example.com/delete-doomed",
          title: "Unique deletion needle",
          tags: ["Doomed tag", "Shared tag"],
        },
      });
      const survivor = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: {
          address: "https://example.com/delete-survivor",
          tags: ["Shared tag"],
        },
      });
      const criteria = {
        scope: "active" as const,
        query: "",
        tags: [],
        favorite: null,
        unread: null,
        sort: "created_desc" as const,
      };
      const selection = new SelectionRepository(
        testDatabase.database,
        () => new Date(NOW),
      ).createIds([doomed.json().id, survivor.json().id], computeCriteriaHash(criteria));

      const response = await injectJson({
        method: "DELETE",
        url: `/api/bookmarks/${doomed.json().id}`,
      });
      expect(response.statusCode).toBe(204);
      expect(
        testDatabase.database
          .prepare(
            "SELECT bookmark_id FROM selection_items WHERE selection_id = ? ORDER BY bookmark_id",
          )
          .all(selection.id),
      ).toEqual([{ bookmark_id: survivor.json().id }]);
      expect(
        testDatabase.database
          .prepare("SELECT rowid FROM bookmark_search WHERE rowid = ?")
          .all(doomed.json().id),
      ).toEqual([]);
      expect(
        testDatabase.database.prepare("SELECT display_name FROM tags ORDER BY name_key").all(),
      ).toEqual([{ display_name: "Shared tag" }]);
      expect(
        new SearchRepository(testDatabase.database).search({
          ...criteria,
          query: "deletion needle",
          limit: 50,
        }),
      ).toMatchObject({ total: 0, items: [] });
    });
  });

  it("keeps a shared icon until its final bookmark reference is deleted", async () => {
    await withFastifyTestHarness(async ({ injectJson, testDatabase }) => {
      const first = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/icon-one" },
      });
      const second = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/icon-two" },
      });
      new IconRepository(testDatabase.database).put({
        contentHash: "shared-icon",
        pngBytes: Buffer.from([137, 80, 78, 71]),
        width: 1,
        height: 1,
        byteLength: 4,
        createdAt: NOW,
      });
      testDatabase.database
        .prepare("UPDATE bookmarks SET icon_hash = 'shared-icon' WHERE id IN (?, ?)")
        .run(first.json().id, second.json().id);

      await injectJson({ method: "DELETE", url: `/api/bookmarks/${first.json().id}` });
      expect(
        testDatabase.database.prepare("SELECT count(*) AS count FROM bookmark_icons").get(),
      ).toEqual({
        count: 1,
      });
      await injectJson({ method: "DELETE", url: `/api/bookmarks/${second.json().id}` });
      expect(
        testDatabase.database.prepare("SELECT count(*) AS count FROM bookmark_icons").get(),
      ).toEqual({
        count: 0,
      });
    });
  });

  it("turns a late pending metadata result into a harmless no-op", async () => {
    await withFastifyTestHarness(async ({ injectJson, testDatabase }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/pending-delete" },
      });
      const id = created.json().id as number;
      const revision = (
        testDatabase.database
          .prepare("SELECT address_revision FROM bookmarks WHERE id = ?")
          .get(id) as { address_revision: number }
      ).address_revision;
      await injectJson({ method: "DELETE", url: `/api/bookmarks/${id}` });

      expect(
        new BookmarkRepository(testDatabase.database).applyMetadata({
          bookmarkId: id,
          addressRevision: revision,
          title: "Late title",
          status: "complete",
          fetchedAt: NOW,
        }),
      ).toBe(false);
      expect(
        testDatabase.database.prepare("SELECT count(*) AS count FROM bookmarks").get(),
      ).toEqual({
        count: 0,
      });
    });
  });
});
