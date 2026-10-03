import { describe, expect, it } from "vitest";
import { bookmarkListQuerySchema } from "~/features/bookmarks/bookmark.validation";

describe("bookmark list query contract", () => {
  it("parses documented query parameters and bounds limits", () => {
    expect(bookmarkListQuerySchema.parse({ query: " guide ", tag: "Reading", limit: "25", cursor: "opaque" })).toEqual({ query: "guide", tag: "Reading", limit: 25, cursor: "opaque" });
    expect(bookmarkListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(bookmarkListQuerySchema.safeParse({ query: "x".repeat(301) }).success).toBe(false);
  });
});
