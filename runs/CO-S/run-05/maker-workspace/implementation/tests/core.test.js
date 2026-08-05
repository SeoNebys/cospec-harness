/*
 * Acceptance + unit tests, runnable with plain Node: `node tests/core.test.js`.
 * Each block cites the approved scenario(s) it exercises.
 */
"use strict";
var assert = require("assert");
var path = require("path");
var fs = require("fs");
var BM = require("../core.js");
var store = require("../store.js"); // returns module.exports; also holds BMStore

var passed = 0, failed = 0, current = "";
function test(name, fn) {
  current = name;
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.log("  ✗ " + name + "\n      " + e.message); }
}
function section(s) { console.log("\n" + s); }

/* ---- SCN-001: Save a link by pasting it ---- */
section("SCN-001  Save a link by pasting it");
test("valid link is added to the top, newest first", function () {
  var r1 = BM.addLink([], "seriouseats.com/rice", "");
  assert.strictEqual(r1.status, "added");
  var r2 = BM.addLink(r1.items, "bogleheads.org/wiki/Index_funds", "");
  assert.strictEqual(r2.items.length, 2);
  assert.strictEqual(r2.items[0].host, "bogleheads.org", "newest is on top");
  assert.strictEqual(r2.items[1].host, "seriouseats.com");
});
test("title, host and icon-initial are derivable", function () {
  var it = BM.makeItem("nytimes.com/2024/best-hikes-near-portland", "");
  assert.strictEqual(it.host, "nytimes.com");
  assert.ok(/best hikes near portland/i.test(it.title), "readable title: " + it.title);
});
test("input is treated immutably (original array unchanged)", function () {
  var start = [];
  BM.addLink(start, "example.com/a", "");
  assert.strictEqual(start.length, 0);
});

/* ---- SCN-002: Find a saved link by searching ---- */
section("SCN-002  Find a saved link by searching");
var sample = BM.addLink(
  BM.addLink(
    BM.addLink([], "seriouseats.com/perfect-rice", "cooking").items,
    "japan-guide.com/kyoto", "travel, japan").items,
  "bogleheads.org/index-funds", "finance").items;
test("typing narrows to matching title/host/tag", function () {
  assert.strictEqual(BM.filterItems(sample, "rice").length, 1);
  assert.strictEqual(BM.filterItems(sample, "kyoto").length, 1);
  assert.strictEqual(BM.filterItems(sample, "finance").length, 1); // by tag
});
test("clearing the search restores everything", function () {
  assert.strictEqual(BM.filterItems(sample, "").length, sample.length);
});

/* ---- SCN-003: Flexible multi-tagging ---- */
section("SCN-003  Tag a link flexibly (multiple tags)");
test("comma-separated tags are parsed, trimmed, lowercased, de-duplicated", function () {
  assert.deepStrictEqual(BM.parseTags("Travel, cooking ,, travel"), ["travel", "cooking"]);
});
test("no tags is valid — bare link saved", function () {
  var it = BM.makeItem("example.com/x", "");
  assert.deepStrictEqual(it.tags, []);
});
test("a link with two tags is found under either", function () {
  var items = BM.addLink([], "timeout.com/tokyo-ramen", "travel, cooking").items;
  assert.strictEqual(BM.filterItems(items, "travel").length, 1);
  assert.strictEqual(BM.filterItems(items, "cooking").length, 1);
});

/* ---- SCN-004: Long title trimmed to a single line (CSS) ---- */
section("SCN-004  Long title/link trimmed to a single line");
test("stylesheet truncates title and address to one line", function () {
  var css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  var titleBlock = css.slice(css.indexOf(".title"));
  assert.ok(/text-overflow:\s*ellipsis/.test(css), "ellipsis rule present");
  assert.ok(/\.title[\s\S]*?white-space:\s*nowrap/.test(css), ".title is single-line");
  assert.ok(/\.url[\s\S]*?white-space:\s*nowrap/.test(css), ".url is single-line");
});

/* ---- SCN-005: No links match the search ---- */
section("SCN-005  No links match the search");
test("a non-matching query filters to zero", function () {
  assert.strictEqual(BM.filterItems(sample, "zzzz").length, 0);
});

/* ---- SCN-006: Reject input that isn't a link ---- */
section("SCN-006  Reject input that isn't a link");
test("junk without a dot is rejected and not added", function () {
  var r = BM.addLink([], "asdf", "");
  assert.strictEqual(r.status, "invalid");
  assert.strictEqual(r.items.length, 0);
});
test("plausible links are accepted (with or without scheme)", function () {
  assert.ok(BM.looksLikeLink("example.com"));
  assert.ok(BM.looksLikeLink("https://sub.example.co.uk/path?x=1"));
  assert.ok(!BM.looksLikeLink("just some words"));
  assert.ok(!BM.looksLikeLink("nodot"));
});

/* ---- SCN-007: Prevent duplicate saves, jump to existing ---- */
section("SCN-007  Prevent duplicate saves and jump to existing");
test("same link (ignoring scheme/www/trailing slash) is a duplicate", function () {
  var items = BM.addLink([], "https://www.japan-guide.com/kyoto/", "").items;
  var r = BM.addLink(items, "japan-guide.com/kyoto", "");
  assert.strictEqual(r.status, "duplicate");
  assert.strictEqual(r.items.length, 1, "no duplicate added");
  assert.strictEqual(r.key, items[0].key, "points at existing entry");
});

/* ---- Persistence: links survive reopening the browser ---- */
section("Persistence (localStorage round-trip)");
test("saved links reload identically after a 'restart'", function () {
  var mem = {};
  store.localStorage = { // injected fake; store.js reads root.localStorage
    getItem: function (k) { return k in mem ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); }
  };
  var items = BM.addLink([], "seriouseats.com/rice", "cooking").items;
  assert.ok(store.BMStore.save(items));
  var reloaded = store.BMStore.load();
  assert.deepStrictEqual(reloaded, items, "round-trips exactly");
});
test("empty/corrupt storage loads as an empty list", function () {
  store.localStorage = { getItem: function () { return "not json"; }, setItem: function () {} };
  assert.deepStrictEqual(store.BMStore.load(), []);
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
