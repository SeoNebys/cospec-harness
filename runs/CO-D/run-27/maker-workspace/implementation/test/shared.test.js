// Unit tests for shared behaviour modules (SCN-002, SCN-004, SCN-008).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, isValidWebUrl, withScheme, looksLikePdf } from "../src/public/shared/normalize.js";
import { buildMatcher, matchesAll } from "../src/public/shared/search.js";
import { mdToHtml, mdToPlain, normalizeTag } from "../src/public/shared/md.js";

test("SCN-002 normalize: host case + trailing slash ignored; scheme/www/path/query kept", () => {
  assert.equal(normalize("https://SITE.com/Article/?ref=A"), "https://site.com/Article?ref=A");
  assert.notEqual(normalize("http://site.com/Article?ref=A"), normalize("https://site.com/Article?ref=A"));
  assert.notEqual(normalize("https://www.site.com/A"), normalize("https://site.com/A"));
  assert.notEqual(normalize("https://site.com/Article?ref=A/"), normalize("https://site.com/Article?ref=A"));
  assert.notEqual(normalize("https://site.com/Article"), normalize("https://site.com/article"));
});

test("valid web url + scheme assumption", () => {
  assert.equal(withScheme("example.com/x"), "https://example.com/x");
  assert.equal(withScheme("http://example.com"), "http://example.com");
  assert.ok(isValidWebUrl("https://example.com"));
  assert.ok(!isValidWebUrl("ftp://example.com"));
  assert.ok(!isValidWebUrl("not a url"));
});

const items = [
  { title: "Rome guide", description: "travel", url: "https://a.com/rome", tags: ["travel", "article"], note: "" },
  { title: "Rome book", description: "reading", url: "https://b.com/rome-book", tags: ["travel", "book"], note: "great intro" },
  { title: "CSS", description: "docs", url: "https://c.com/css", tags: ["dev"], note: "" },
];
function filter(q, inc = [], exc = []) { const m = buildMatcher(q); return items.filter((it) => matchesAll(it, m, inc, exc)).map((x) => x.title); }

test("SCN-004 search: words, AND/OR/NOT, phrases, #tag", () => {
  assert.deepEqual(filter("rome"), ["Rome guide", "Rome book"]);
  assert.deepEqual(filter("ROME"), ["Rome guide", "Rome book"]);
  assert.deepEqual(filter("rome AND book"), ["Rome book"]);
  assert.deepEqual(filter("rome NOT book"), ["Rome guide"]);
  assert.deepEqual(filter("css OR book"), ["Rome book", "CSS"]);
  assert.deepEqual(filter("#travel AND #book"), ["Rome book"]);
  assert.deepEqual(filter("rome book"), ["Rome book"]); // implicit AND
  assert.deepEqual(filter('"great intro"'), ["Rome book"]); // phrase, matches note
  assert.deepEqual(filter('"and"'), []); // quoted operator is literal, no match
});

test("SCN-010 include/exclude tag rules (all included, none excluded)", () => {
  assert.deepEqual(filter("", ["travel"]), ["Rome guide", "Rome book"]);
  assert.deepEqual(filter("", ["travel"], ["book"]), ["Rome guide"]);
  assert.deepEqual(filter("", ["travel", "book"]), ["Rome book"]);
});

test("SCN-008 markdown: safe render + plain preview + tag normalization", () => {
  const html = mdToHtml("# H\n**b** *i* [x](https://e.com)\n- a\n- b");
  assert.ok(html.includes("<h1>") && html.includes("<strong>b</strong>") && html.includes("<em>i</em>"));
  assert.ok(html.includes('<a href="https://e.com" target="_blank"') && html.includes("<ul>"));
  assert.ok(!mdToHtml("<script>x</script>").includes("<script>"));
  assert.equal(mdToPlain("# Title\n- one"), "Title • one");
  assert.equal(normalizeTag("  #Deep Learning "), "deep-learning");
});

test("PDF url hint", () => { assert.ok(looksLikePdf("https://x.com/a.pdf")); assert.ok(!looksLikePdf("https://x.com/a")); });
