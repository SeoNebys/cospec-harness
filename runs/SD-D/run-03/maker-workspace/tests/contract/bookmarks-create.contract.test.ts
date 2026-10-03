import { Value } from "typebox/value";
import {
  BookmarkPageSchema,
  BookmarkSchema,
  MetadataPreviewSchema,
} from "../../src/shared/contracts/api.js";
import {
  DuplicateBookmarkProblemSchema,
  ProblemSchema,
} from "../../src/shared/contracts/errors.js";
import { withFastifyTestHarness } from "../helpers/fastify.js";

describe("bookmark capture HTTP contract", () => {
  it("creates, lists, and reads an address-only bookmark", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/articles/one" },
      });
      expect(created.statusCode).toBe(201);
      expect(Value.Check(BookmarkSchema, created.json())).toBe(true);

      const listed = await injectJson({ method: "GET", url: "/api/bookmarks" });
      expect(listed.statusCode).toBe(200);
      expect(Value.Check(BookmarkPageSchema, listed.json())).toBe(true);

      const detail = await injectJson({
        method: "GET",
        url: `/api/bookmarks/${created.json().id}`,
      });
      expect(detail.statusCode).toBe(200);
      expect(Value.Check(BookmarkSchema, detail.json())).toBe(true);
    });
  });

  it("returns contract-shaped validation and duplicate problems", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const invalid = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "file:///etc/passwd" },
      });
      expect(invalid.statusCode).toBe(422);
      expect(Value.Check(ProblemSchema, invalid.json())).toBe(true);

      await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://EXAMPLE.com:443/same" },
      });
      const duplicate = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/same" },
      });
      expect(duplicate.statusCode).toBe(409);
      expect(Value.Check(DuplicateBookmarkProblemSchema, duplicate.json())).toBe(true);
    });
  });

  it("returns a usable metadata preview and no remote icon URL", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const response = await injectJson({
        method: "POST",
        url: "/api/metadata/preview",
        payload: { address: "https://example.com/story" },
      });
      expect(response.statusCode).toBe(200);
      expect(Value.Check(MetadataPreviewSchema, response.json())).toBe(true);
      expect(response.json()).not.toHaveProperty("iconUrl");
    });
  });
});
