import { Value } from "typebox/value";
import {
  DuplicateBookmarkProblemSchema,
  ProblemSchema,
} from "../../src/shared/contracts/errors.js";
import { withFastifyTestHarness } from "../helpers/fastify.js";

describe("bookmark deletion HTTP contract", () => {
  it("returns 204 once and 404 after the bookmark is permanently gone", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/delete-contract" },
      });
      const first = await injectJson({
        method: "DELETE",
        url: `/api/bookmarks/${created.json().id}`,
      });
      expect(first.statusCode).toBe(204);
      expect(first.body).toBe("");

      const missing = await injectJson({
        method: "DELETE",
        url: `/api/bookmarks/${created.json().id}`,
      });
      expect(missing.statusCode).toBe(404);
      expect(Value.Check(ProblemSchema, missing.json())).toBe(true);
      expect(missing.json()).toEqual({
        code: "BOOKMARK_NOT_FOUND",
        message: "Bookmark not found.",
      });
    });
  });

  it("returns 404 for an unknown bookmark without affecting existing content", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const existing = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/keep-existing" },
      });
      const missing = await injectJson({ method: "DELETE", url: "/api/bookmarks/999999" });
      expect(missing.statusCode).toBe(404);
      expect(
        (await injectJson({ method: "GET", url: `/api/bookmarks/${existing.json().id}` }))
          .statusCode,
      ).toBe(200);
    });
  });

  it("returns archived duplicate navigation details and rolls back the full patch", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const source = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/conflict-source", title: "Original" },
      });
      const target = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/conflict-target" },
      });
      await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${target.json().id}`,
        payload: { archived: true },
      });
      const conflict = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${source.json().id}`,
        payload: {
          address: "https://EXAMPLE.com:443/conflict-target",
          title: "Must roll back",
        },
      });

      expect(conflict.statusCode).toBe(409);
      expect(Value.Check(DuplicateBookmarkProblemSchema, conflict.json())).toBe(true);
      expect(conflict.json()).toMatchObject({
        existingBookmarkId: target.json().id,
        existingScope: "archived",
      });
      expect(
        (await injectJson({ method: "GET", url: `/api/bookmarks/${source.json().id}` })).json(),
      ).toMatchObject({ address: "https://example.com/conflict-source", title: "Original" });
    });
  });
});
