import { describe, expect, it } from "vitest";
import { normalizeTags, validateAndNormalizeUrl } from "../../src/services/url.js";
import { AppError } from "../../src/errors.js";

describe("validateAndNormalizeUrl", () => {
  it("accepts http/https and normalizes host case + trailing slash", () => {
    const a = validateAndNormalizeUrl("HTTPS://Example.com/Path/");
    expect(a.normalizedUrl).toBe("https://example.com/Path");

    const b = validateAndNormalizeUrl("https://example.com/Path");
    expect(b.normalizedUrl).toBe(a.normalizedUrl);
  });

  it("treats bare host with trailing slash and without as the same", () => {
    const a = validateAndNormalizeUrl("https://example.com");
    const b = validateAndNormalizeUrl("https://example.com/");
    expect(a.normalizedUrl).toBe(b.normalizedUrl);
  });

  it("drops the fragment for dedupe but keeps the query string", () => {
    const a = validateAndNormalizeUrl("https://example.com/p?x=1#frag");
    expect(a.normalizedUrl).toBe("https://example.com/p?x=1");
  });

  it("rejects blank input", () => {
    expect(() => validateAndNormalizeUrl("   ")).toThrow(AppError);
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => validateAndNormalizeUrl("ftp://example.com")).toThrow(/http/);
    expect(() => validateAndNormalizeUrl("javascript:alert(1)")).toThrow(AppError);
  });

  it("rejects malformed addresses", () => {
    expect(() => validateAndNormalizeUrl("not a url")).toThrow(AppError);
  });
});

describe("normalizeTags", () => {
  it("trims, lower-cases, drops empties and de-duplicates", () => {
    expect(normalizeTags([" Tech ", "tech", "", "Reading"])).toEqual([
      "tech",
      "reading",
    ]);
  });

  it("returns [] for undefined", () => {
    expect(normalizeTags(undefined)).toEqual([]);
  });
});
