import { describe, expect, it } from "vitest";
import { bookmarkInputSchema } from "~/features/bookmarks/bookmark.validation";

describe("bookmark maintenance contract", () => {
  it("shares the complete bookmark input contract for PATCH", () => {
    expect(bookmarkInputSchema.safeParse({ url: "https://example.com", title: "Updated", description: null, tags: ["Reading"] }).success).toBe(true);
    expect(bookmarkInputSchema.safeParse({ url: "javascript:alert(1)", title: "Bad", tags: [] }).success).toBe(false);
  });
});
