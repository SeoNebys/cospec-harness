import { describe, expect, it } from "vitest";
import { parseSearchQuery, SearchQueryError } from "@/features/bookmarks/search-parser";

describe("search query parser", () => {
  it("treats adjacent terms as AND", () => {
    expect(parseSearchQuery("design systems")).toEqual({ type: "and", left: { type: "term", value: "design" }, right: { type: "term", value: "systems" } });
  });

  it("applies NOT, then AND, then OR precedence", () => {
    expect(parseSearchQuery("one OR two AND NOT three")).toMatchObject({ type: "or", right: { type: "and", right: { type: "not" } } });
  });

  it("parses exact phrases and quoted tags", () => {
    expect(parseSearchQuery('"design systems" AND tag:"machine learning"')).toEqual({
      type: "and",
      left: { type: "phrase", value: "design systems" },
      right: { type: "tag", value: "machine learning" },
    });
  });

  it("keeps operators inside quotes literal", () => {
    expect(parseSearchQuery('"AND OR NOT"')).toEqual({ type: "phrase", value: "AND OR NOT" });
  });

  it("lets parentheses override precedence", () => {
    expect(parseSearchQuery("(one OR two) AND three")).toMatchObject({ type: "and", left: { type: "or" } });
  });

  it.each(["one AND", '"unfinished', "()", "tag:", "one OR )"])("reports a position for malformed query %s", (query) => {
    try { parseSearchQuery(query); throw new Error("expected parser failure"); } catch (error) {
      expect(error).toBeInstanceOf(SearchQueryError);
      expect((error as SearchQueryError).offset).toBeGreaterThanOrEqual(0);
    }
  });

  it("enforces the character limit", () => {
    expect(() => parseSearchQuery("a".repeat(1001))).toThrow("1,000");
  });
});
