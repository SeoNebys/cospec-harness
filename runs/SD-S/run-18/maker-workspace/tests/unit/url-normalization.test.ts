import { describe, expect, it } from "vitest";
import { fallbackTitle, normalizeBookmarkUrl } from "~/features/bookmarks/url-normalization";

describe("normalizeBookmarkUrl", () => {
  it.each([
    [" example.com/path#section ", "https://example.com/path"],
    ["HTTPS://EXAMPLE.COM:443/a?b=2&a=1", "https://example.com/a?b=2&a=1"],
    ["http://example.com:80", "http://example.com/"],
    ["https://bücher.example/", "https://xn--bcher-kva.example/"],
  ])("normalizes %s", (input, expected) => expect(normalizeBookmarkUrl(input)).toBe(expected));

  it("keeps HTTP and HTTPS distinct", () => {
    expect(normalizeBookmarkUrl("http://example.com")).not.toBe(normalizeBookmarkUrl("https://example.com"));
  });

  it.each(["file:///tmp/x", "javascript:alert(1)", "https://u:p@example.com", "localhost", "not a url"])(
    "rejects %s",
    (input) => expect(() => normalizeBookmarkUrl(input)).toThrow(),
  );

  it("enforces the URL limit", () => expect(() => normalizeBookmarkUrl(`https://example.com/${"x".repeat(2050)}`)).toThrow());
  it("creates a readable fallback", () => expect(fallbackTitle("https://example.com/good-article")).toBe("example.com — good article"));
});
