import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, InvalidUrlError } from "../../src/url.js";

test("adds https:// when the scheme is omitted (SCN-010)", () => {
  const { url, host } = normalizeUrl("example.com/story");
  assert.equal(url, "https://example.com/story");
  assert.equal(host, "example.com");
});

test("strips leading www from host", () => {
  assert.equal(normalizeUrl("https://www.nytimes.com/a").host, "nytimes.com");
});

test("keeps an explicit http scheme", () => {
  assert.equal(normalizeUrl("http://example.org").url, "http://example.org/");
});

test("rejects non-address text (SCN-010)", () => {
  assert.throws(() => normalizeUrl("not a url"), InvalidUrlError);
  assert.throws(() => normalizeUrl("hello"), InvalidUrlError);
  assert.throws(() => normalizeUrl(""), InvalidUrlError);
});

test("rejects non-http(s) schemes", () => {
  assert.throws(() => normalizeUrl("javascript:alert(1)"), InvalidUrlError);
  assert.throws(() => normalizeUrl("ftp://example.com"), InvalidUrlError);
});
