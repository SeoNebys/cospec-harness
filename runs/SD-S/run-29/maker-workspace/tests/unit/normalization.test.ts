import { describe, expect, it } from "vitest";
import { normalizeBookmarkUrl, normalizeTag, normalizeTitle } from "@/lib/domain/normalization";

describe("bookmark normalization", () => {
  it("normalizes unambiguous URL equivalents", () => expect(normalizeBookmarkUrl(" HTTP://Example.com:80 ").normalizedUrl).toBe("http://example.com/"));
  it("preserves meaningful query order and fragments", () => {
    expect(normalizeBookmarkUrl("https://example.com/?a=1&b=2#one").normalizedUrl).not.toBe(normalizeBookmarkUrl("https://example.com/?b=2&a=1#two").normalizedUrl);
  });
  it.each(["javascript:alert(1)", "ftp://example.com", "https://user:pass@example.com"])("rejects unsafe URL %s", (url) => expect(() => normalizeBookmarkUrl(url)).toThrow());
  it("collapses title and tag whitespace and folds tag case", () => {
    expect(normalizeTitle("  A   good title ")).toBe("A good title");
    expect(normalizeTag("  DeSign ")).toEqual({ name: "DeSign", normalizedName: "design" });
  });
});
