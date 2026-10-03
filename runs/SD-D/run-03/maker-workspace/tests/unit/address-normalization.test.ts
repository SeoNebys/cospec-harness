import { describe, expect, it } from "vitest";

import { fallbackTitleFromAddress } from "../../src/server/services/bookmarks/address-normalizer.js";
import { type AddressValidationError, normalizeAddress } from "../../src/shared/types/address.js";

describe("bookmark address validation", () => {
  it.each([
    "https://example.com",
    "http://example.com/articles/one?ref=test#details",
    " HTTPS://EXAMPLE.COM:443/path ",
    "https://xn--bcher-kva.example/",
    "https://[2001:4860:4860::8888]/dns",
  ])("accepts an explicit HTTP(S) address: %s", (input) => {
    const result = normalizeAddress(input);

    expect(result.address).toBe(input.trim());
    expect(result.url).toBeInstanceOf(URL);
    expect(["http:", "https:"]).toContain(result.url.protocol);
  });

  it.each([
    ["", "ADDRESS_REQUIRED"],
    ["   ", "ADDRESS_REQUIRED"],
    ["example.com", "ADDRESS_INVALID"],
    ["//example.com/path", "ADDRESS_INVALID"],
    ["https:example.com", "ADDRESS_INVALID"],
    ["ftp://example.com/file", "ADDRESS_UNSUPPORTED_SCHEME"],
    ["javascript:alert(1)", "ADDRESS_UNSUPPORTED_SCHEME"],
    ["mailto:reader@example.com", "ADDRESS_UNSUPPORTED_SCHEME"],
    ["https://", "ADDRESS_INVALID"],
    ["https://exa mple.com", "ADDRESS_INVALID"],
    ["https://example.com:99999", "ADDRESS_INVALID"],
    ["https://example.com:/path", "ADDRESS_INVALID"],
    ["https://example.com\\private", "ADDRESS_INVALID"],
  ] as const)("rejects invalid input %j with actionable code %s", (input, code) => {
    expect(() => normalizeAddress(input)).toThrowError(
      expect.objectContaining({ code, field: "address" } satisfies Partial<AddressValidationError>),
    );
  });
});

describe("FR-005 address identity", () => {
  it.each([
    [" https://Example.COM ", "https://example.com/"],
    ["HTTP://EXAMPLE.COM:80", "http://example.com/"],
    ["https://example.com:443/path", "https://EXAMPLE.com/path"],
    ["https://example.com?from=mail", "https://example.com/?from=mail"],
    ["https://example.com#intro", "https://example.com/#intro"],
    ["https://B\u00dcCHER.example/Lesen", "https://xn--bcher-kva.example/Lesen"],
  ])("treats %j and %j as equivalent", (left, right) => {
    expect(normalizeAddress(left).normalizedAddress).toBe(
      normalizeAddress(right).normalizedAddress,
    );
  });

  it.each([
    ["http://example.com/", "https://example.com/"],
    ["https://example.com/story", "https://example.com/Story"],
    ["https://example.com/story", "https://example.com/story/"],
    ["https://example.com/story?a=1", "https://example.com/story?a=2"],
    ["https://example.com/story?a=1&b=2", "https://example.com/story?b=2&a=1"],
    ["https://example.com/story#one", "https://example.com/story#two"],
    ["https://example.com:8443/", "https://example.com/"],
    ["https://example.com/a%2Fb", "https://example.com/a/b"],
    ["https://example.com/a%2Fb", "https://example.com/a%2fb"],
    ["https://reader@example.com/", "https://example.com/"],
    ["https://example.com/a/../b", "https://example.com/b"],
  ])("keeps %j and %j distinct", (left, right) => {
    expect(normalizeAddress(left).normalizedAddress).not.toBe(
      normalizeAddress(right).normalizedAddress,
    );
  });

  it("uses the same identity for archived and active bookmarks", () => {
    const archivedBookmark = {
      archivedAt: "2026-09-17T10:00:00.000Z",
      normalizedAddress: normalizeAddress("https://Example.com:443").normalizedAddress,
    };

    const attemptedAddress = normalizeAddress(" https://example.com/ ").normalizedAddress;

    expect(archivedBookmark.archivedAt).not.toBeNull();
    expect(attemptedAddress).toBe(archivedBookmark.normalizedAddress);
  });
});

describe("address-derived fallback titles", () => {
  it.each([
    ["https://www.example.com/", "example.com"],
    ["https://example.com/articles/how-to-test", "How to test \u2014 example.com"],
    ["https://example.com/guides/hello%20world", "Hello world \u2014 example.com"],
    ["https://example.com/archive/", "Archive \u2014 example.com"],
    ["https://example.com/?utm_source=mail#top", "example.com"],
  ])("creates a readable title for %s", (address, expected) => {
    expect(fallbackTitleFromAddress(address)).toBe(expected);
  });

  it("bounds an unusually long path-derived title", () => {
    const title = fallbackTitleFromAddress(`https://example.com/${"a".repeat(500)}`);

    expect(title).toContain("example.com");
    expect(title.length).toBeLessThanOrEqual(120);
    expect(title).toContain("\u2026");
  });
});
