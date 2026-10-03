import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, isValidLink, sameLink, findDuplicate, hostFromUrl } from "../../public/model.mjs";

test("normalizeUrl adds https and trims", () => {
  assert.equal(normalizeUrl("  example.com/x "), "https://example.com/x");
  assert.equal(normalizeUrl("http://a.com"), "http://a.com");
  assert.equal(normalizeUrl(""), "");
});

test("isValidLink accepts dotted http(s) hosts", () => {
  assert.ok(isValidLink("https://example.com"));
  assert.ok(isValidLink("http://sub.example.co.uk/path?q=1"));
});

test("isValidLink rejects invalid input", () => {
  assert.ok(!isValidLink("https://not a link"));
  assert.ok(!isValidLink("https://localhostnodot"));
  assert.ok(!isValidLink("ftp://example.com"));
  assert.ok(!isValidLink("just text"));
});

test("sameLink ignores trailing slash and case", () => {
  assert.ok(sameLink("https://Example.com/a/", "https://example.com/a"));
  assert.ok(!sameLink("https://example.com/a", "https://example.com/b"));
});

test("findDuplicate finds an existing bookmark", () => {
  const list = [{ url: "https://example.com/a" }, { url: "https://other.com/" }];
  assert.equal(findDuplicate(list, "https://example.com/a/").url, "https://example.com/a");
  assert.equal(findDuplicate(list, "https://new.com"), null);
});

test("hostFromUrl strips www", () => {
  assert.equal(hostFromUrl("https://www.example.com/x"), "example.com");
});
