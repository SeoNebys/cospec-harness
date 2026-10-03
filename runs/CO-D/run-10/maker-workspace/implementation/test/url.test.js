import test from "node:test";
import assert from "node:assert/strict";
import { cleanUrl, normalizeUrl, parseWebUrl } from "../lib/url.js";

test("completes and validates ordinary web addresses", () => {
  assert.equal(cleanUrl("example.com/story"), "https://example.com/story");
  assert.throws(() => parseWebUrl("not an address"), /complete web address/);
  assert.throws(() => parseWebUrl("file:///tmp/item"), /complete web address/);
});

test("normalizes superficial duplicate variations", () => {
  const expected = "example.com/story?a=1";
  assert.equal(normalizeUrl("https://www.example.com/story/?utm_source=newsletter&a=1#section"), expected);
  assert.equal(normalizeUrl("https://example.com/story?a=1&fbclid=tracking"), expected);
});

test("retains meaningful query information", () => {
  assert.notEqual(normalizeUrl("https://example.com/search?q=one"), normalizeUrl("https://example.com/search?q=two"));
});
