import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTag, normalizeTags } from "../../lib/tags/normalize";
import { escapeLike, normalizeForSearch } from "../../lib/text/normalize";
import { fallbackTitle, normalizeUrl, UrlValidationError } from "../../lib/urls/normalize";

test("normalizes common URLs and strips fragments", () => {
  assert.equal(normalizeUrl("Example.COM/path#part").url, "https://example.com/path");
});

test("rejects unsupported schemes, credentials, and ports", () => {
  for (const value of ["file:///tmp/x", "https://a:b@example.com", "https://example.com:8443"]) {
    assert.throws(() => normalizeUrl(value), UrlValidationError);
  }
});

test("creates a readable fallback title", () => {
  assert.equal(fallbackTitle("https://www.example.com/guide/intro"), "intro");
});

test("normalizes Unicode search and tag keys", () => {
  assert.equal(normalizeForSearch("  Ｃafé  "), "café");
  assert.equal(normalizeTag("  Work   Notes ").name, "Work Notes");
  assert.equal(normalizeTags(["Work", "work"]).length, 1);
  assert.equal(escapeLike("50%_ok\\"), "50\\%\\_ok\\\\");
});
