import { describe, expect, it } from "vitest";
import { bookmarkInputSchema } from "~/features/bookmarks/bookmark.validation";

describe("bookmark input validation", () => {
  it("accepts a normalized bookmark with no tags", () => {
    expect(bookmarkInputSchema.parse({ url: "https://example.com", title: "Example", description: null, tags: [] }).title).toBe("Example");
  });

  it.each([
    [{ url: "file:///tmp/a", title: "Title", tags: [] }, "url"],
    [{ url: "https://example.com", title: "", tags: [] }, "title"],
    [{ url: "https://example.com", title: "x".repeat(301), tags: [] }, "title"],
    [{ url: "https://example.com", title: "Title", description: "x".repeat(1001), tags: [] }, "description"],
  ])("rejects invalid %s", (input, field) => {
    const result = bookmarkInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path[0]).toBe(field);
  });
});
