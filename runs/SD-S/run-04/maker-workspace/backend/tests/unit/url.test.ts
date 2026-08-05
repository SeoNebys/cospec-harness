import { describe, it, expect } from "vitest";
import { isValidUrl, normalizeUrl, validateAndNormalize } from "../../src/services/url.js";

describe("isValidUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
    expect(isValidUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("rejects non-URLs and non-web schemes", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("example.com")).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it("lowercases scheme and host and strips the trailing slash", () => {
    expect(normalizeUrl("HTTPS://Example.COM/")).toBe("https://example.com");
  });

  it("removes default ports", () => {
    expect(normalizeUrl("http://example.com:80/page")).toBe("http://example.com/page");
    expect(normalizeUrl("https://example.com:443/page")).toBe("https://example.com/page");
  });

  it("strips tracking params and sorts the rest", () => {
    expect(normalizeUrl("https://example.com/p?utm_source=x&b=2&a=1&fbclid=zzz")).toBe(
      "https://example.com/p?a=1&b=2",
    );
  });

  it("drops the fragment", () => {
    expect(normalizeUrl("https://example.com/p#section")).toBe("https://example.com/p");
  });

  it("treats trivially different forms as the same normalized key", () => {
    const a = normalizeUrl("https://example.com/article/");
    const b = normalizeUrl("https://example.com/article?utm_campaign=news");
    expect(a).toBe(b);
  });
});

describe("validateAndNormalize", () => {
  it("throws on an empty or malformed address", () => {
    expect(() => validateAndNormalize("")).toThrow();
    expect(() => validateAndNormalize("nope")).toThrow();
  });

  it("returns trimmed original and normalized form", () => {
    expect(validateAndNormalize("  https://Example.com/  ")).toEqual({
      url: "https://Example.com/",
      normalized: "https://example.com",
    });
  });
});
