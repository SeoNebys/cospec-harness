import { Value } from "typebox/value";
import { BookmarkSchema, MetadataRefreshResponseSchema } from "../../src/shared/contracts/api.js";
import { DuplicateBookmarkProblemSchema } from "../../src/shared/contracts/errors.js";
import { withFastifyTestHarness } from "../helpers/fastify.js";

describe("bookmark update HTTP contract", () => {
  it("patches all organization fields and returns contract-shaped tags", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/update" },
      });
      const response = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${created.json().id}`,
        payload: {
          title: "Updated",
          description: "Updated description",
          noteMarkdown: "**Note**",
          tags: ["One", "Two"],
          favorite: true,
          unread: true,
          archived: true,
        },
      });
      expect(response.statusCode).toBe(200);
      expect(Value.Check(BookmarkSchema, response.json())).toBe(true);
      expect(response.json().tags.map((tag: { name: string }) => tag.name)).toEqual(["One", "Two"]);
    });
  });

  it("queues metadata refresh and can explicitly accept retrieved candidates", async () => {
    await withFastifyTestHarness(async ({ injectJson, testDatabase }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/candidate", title: "Manual" },
      });
      testDatabase.database
        .prepare(
          "UPDATE bookmarks SET retrieved_title_candidate = ?, retrieved_description_candidate = ? WHERE id = ?",
        )
        .run("Retrieved", "Retrieved description", created.json().id);
      const accepted = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${created.json().id}`,
        payload: { acceptRetrievedTitle: true, acceptRetrievedDescription: true },
      });
      expect(accepted.json()).toMatchObject({
        title: "Retrieved",
        titleProvenance: "retrieved",
        retrievedTitleCandidate: null,
        description: "Retrieved description",
        descriptionProvenance: "retrieved",
        retrievedDescriptionCandidate: null,
      });

      const refresh = await injectJson({
        method: "POST",
        url: `/api/bookmarks/${created.json().id}/metadata-refresh`,
        payload: {},
      });
      expect(refresh.statusCode).toBe(202);
      expect(Value.Check(MetadataRefreshResponseSchema, refresh.json())).toBe(true);
      expect(
        testDatabase.database
          .prepare(
            "SELECT metadata_status, metadata_error_code, metadata_fetched_at FROM bookmarks WHERE id = ?",
          )
          .get(created.json().id),
      ).toEqual({
        metadata_status: "pending",
        metadata_error_code: null,
        metadata_fetched_at: null,
      });
    });
  });

  it("returns duplicate navigation details without partially changing the edited row", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const first = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/a" },
      });
      const second = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/b" },
      });
      const conflict = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${first.json().id}`,
        payload: { address: "https://example.com/b", title: "Must not apply" },
      });
      expect(conflict.statusCode).toBe(409);
      expect(Value.Check(DuplicateBookmarkProblemSchema, conflict.json())).toBe(true);
      expect(
        (await injectJson({ method: "GET", url: `/api/bookmarks/${first.json().id}` })).json()
          .title,
      ).not.toBe("Must not apply");
      expect(conflict.json().existingBookmarkId).toBe(second.json().id);
    });
  });

  it("returns field-specific validation and leaves prior content unchanged", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/validation", title: "Valid title" },
      });
      const response = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${created.json().id}`,
        payload: { title: "   ", favorite: true },
      });
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: "TITLE_REQUIRED", field: "title" });
      expect(
        (await injectJson({ method: "GET", url: `/api/bookmarks/${created.json().id}` })).json(),
      ).toMatchObject({ title: "Valid title", favorite: false });
    });
  });

  it("reflects tag replacement in the tag-list contract", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/tag-list", tags: ["Old"] },
      });
      await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${created.json().id}`,
        payload: { tags: ["New"] },
      });
      expect((await injectJson({ method: "GET", url: "/api/tags" })).json()).toEqual([
        { id: expect.any(Number), name: "New", activeBookmarkCount: 1 },
      ]);
    });
  });
});
