import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, isPlausibleLink, ensureScheme, isPdf } from "../../src/normalize.js";

test("same-link rule ignores scheme, www, trailing slash, case (SCN-003)", () => {
  const a = normalizeUrl("https://www.nasa.gov/webb/");
  assert.equal(a, normalizeUrl("nasa.gov/webb"));
  assert.equal(a, normalizeUrl("HTTP://NASA.GOV/webb"));
});

test("different paths / query strings stay distinct", () => {
  assert.notEqual(normalizeUrl("a.com/x"), normalizeUrl("a.com/y"));
  assert.notEqual(normalizeUrl("a.com/x"), normalizeUrl("a.com/x?q=1"));
});

test("plausible link accepts addresses, rejects non-links (SCN-008)", () => {
  assert.ok(isPlausibleLink("https://example.com"));
  assert.ok(isPlausibleLink("example.com/page"));
  assert.ok(!isPlausibleLink("hello world"));
  assert.ok(!isPlausibleLink("banana"));
  assert.ok(!isPlausibleLink(""));
});

test("ensureScheme adds https when missing", () => {
  assert.equal(ensureScheme("example.com"), "https://example.com");
  assert.equal(ensureScheme("http://x.com"), "http://x.com");
});

test("isPdf detects pdf links", () => {
  assert.ok(isPdf("https://x.com/a.pdf"));
  assert.ok(isPdf("https://x.com/a.pdf?v=1"));
  assert.ok(!isPdf("https://x.com/a.html"));
});
