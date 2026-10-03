import { describe, expect, it } from "vitest";
import { normalizeBookmarkUrl, UrlValidationError } from "@/features/bookmarks/url-normalizer";

describe("normalizeBookmarkUrl", () => {
  it("adds https to an unambiguous host and creates a fallback title", () => {
    expect(normalizeBookmarkUrl(" example.com/articles/one ")).toMatchObject({
      url: "https://example.com/articles/one",
      normalizedUrl: "https://example.com/articles/one",
      fallbackTitle: "Example.com — one",
      version: 1,
    });
  });

  it("normalizes host case, default ports, and dot segments", () => {
    expect(normalizeBookmarkUrl("HTTPS://Example.COM:443/a/../b").normalizedUrl).toBe("https://example.com/b");
  });

  it("preserves path case, query order, and fragments", () => {
    const value = "https://example.com/Path/?b=2&a=1#Result";
    expect(normalizeBookmarkUrl(value).normalizedUrl).toBe(value);
  });

  it.each(["file:///tmp/a", "javascript:alert(1)", "ftp://example.com/file"])("rejects unsafe scheme %s", (value) => {
    expect(() => normalizeBookmarkUrl(value)).toThrow(UrlValidationError);
  });

  it("rejects embedded credentials", () => {
    expect(() => normalizeBookmarkUrl("https://user:pass@example.com")).toThrow("credentials");
  });

  it("rejects inputs over 4096 characters", () => {
    expect(() => normalizeBookmarkUrl(`https://example.com/${"a".repeat(4090)}`)).toThrow("4,096");
  });
});
