import { describe, expect, it } from "vitest";
import { bookmarkInputSchema, metadataPreviewSchema } from "~/features/bookmarks/bookmark.validation";

describe("bookmark create contract schemas", () => {
  it("accepts the documented bookmark input", () => expect(bookmarkInputSchema.safeParse({ url: "https://example.com", title: "Example", description: null, tags: [] }).success).toBe(true));
  it("accepts retrieved and fallback preview bodies", () => {
    expect(metadataPreviewSchema.safeParse({ requestId: "r1", url: "https://example.com/", title: "Example", description: null, status: "fallback", warningCode: "missing_title", duplicate: null }).success).toBe(true);
  });
});
