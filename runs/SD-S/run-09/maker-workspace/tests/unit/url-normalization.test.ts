import { describe, expect, it } from "vitest";
import { parseBookmarkUrl } from "../../src/server/metadata/url-policy.js";

describe("bookmark URL policy", () => {
  it("trims, preserves display fragments, and removes fragments from duplicate keys", () => {
    const parsed = parseBookmarkUrl("  https://Example.com/read/me#part  ");
    expect(parsed.displayUrl).toBe("https://Example.com/read/me#part");
    expect(parsed.normalizedUrl).toBe("https://example.com/read/me");
    expect(parsed.fallbackTitle).toBe("example.com — me");
  });
  it.each(["ftp://example.com", "javascript:alert(1)"])("rejects %s", (value) => expect(() => parseBookmarkUrl(value)).toThrow());
  it("rejects credentials", () => expect(() => parseBookmarkUrl("https://user:pass@example.com")).toThrow());
  it("keeps fragments out of network requests", () => expect(parseBookmarkUrl("https://example.com/#x").networkUrl.hash).toBe(""));
});
