import { describe, expect, it } from "vitest";
import { bookmarkInputSchema, tagNameSchema } from "~/features/bookmarks/bookmark.validation";

describe("tag contract", () => {
  it("accepts up to 20 tags of 1–50 characters", () => {
    expect(bookmarkInputSchema.safeParse({ url: "https://example.com", title: "Example", tags: ["research", "design"] }).success).toBe(true);
    expect(tagNameSchema.safeParse("x".repeat(51)).success).toBe(false);
  });
});
