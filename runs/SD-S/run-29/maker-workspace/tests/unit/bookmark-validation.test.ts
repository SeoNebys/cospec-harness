import { describe, expect, it } from "vitest";
import { bookmarkInputSchema } from "@/lib/validation/bookmark";

describe("bookmark input", () => {
  it("accepts valid input and merges equivalent tags", () => {
    const value = bookmarkInputSchema.parse({ title: "Example", url: "https://example.com", tags: ["Read", " read "] });
    expect(value.tags).toHaveLength(1);
  });
  it("enforces field limits", () => {
    expect(bookmarkInputSchema.safeParse({ title: "x".repeat(201), url: "https://example.com", tags: [] }).success).toBe(false);
    expect(bookmarkInputSchema.safeParse({ title: "Ok", url: "https://example.com", tags: Array.from({ length: 21 }, (_, i) => `tag${i}`) }).success).toBe(false);
  });
});
