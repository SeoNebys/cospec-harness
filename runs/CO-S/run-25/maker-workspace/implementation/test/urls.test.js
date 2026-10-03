"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { normUrl, hostOf, canon, isPlausibleUrl, isPdf } = require("../shared/urls.js");

test("normUrl adds https when scheme omitted", () => {
  assert.equal(normUrl("example.com/a"), "https://example.com/a");
  assert.equal(normUrl("http://example.com"), "http://example.com");
});

test("hostOf strips www", () => {
  assert.equal(hostOf("https://www.example.com/x"), "example.com");
  assert.equal(hostOf("news.ycombinator.com"), "news.ycombinator.com");
});

test("canon treats scheme/www/trailing-slash/#fragment as same (SCN-008)", () => {
  const c = "https://example.com/a";
  assert.equal(canon(c), canon("http://example.com/a"));
  assert.equal(canon(c), canon("https://example.com/a/"));
  assert.equal(canon(c), canon("https://www.example.com/a"));
  assert.equal(canon(c), canon("example.com/a"));
  assert.equal(canon(c), canon("https://example.com/a#top"));
});

test("canon keeps query string significant (SCN-008)", () => {
  assert.notEqual(canon("https://example.com/a"), canon("https://example.com/a?x=1"));
  assert.notEqual(canon("https://example.com/a"), canon("https://example.com/b"));
});

test("isPlausibleUrl rejects non-addresses (SCN-011)", () => {
  assert.equal(isPlausibleUrl("hello world"), false);
  assert.equal(isPlausibleUrl("banana"), false);
  assert.equal(isPlausibleUrl(""), false);
  assert.equal(isPlausibleUrl("example.com"), true);
  assert.equal(isPlausibleUrl("https://example.com/a/b"), true);
  assert.equal(isPlausibleUrl("localhost:3000"), true);
});

test("isPdf detects direct pdf links (SCN-007)", () => {
  assert.equal(isPdf("https://x.org/a.pdf"), true);
  assert.equal(isPdf("https://x.org/a.pdf?v=2"), true);
  assert.equal(isPdf("https://x.org/a.html"), false);
});
