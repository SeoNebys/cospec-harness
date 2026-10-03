"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Q = require("../shared/query.js");

const items = [
  { title: "Web APIs | MDN", desc: "reference of interfaces for web apps", note: "handy reference fetch streams", host: "developer.mozilla.org", tags: ["dev", "reference"] },
  { title: "Bookmark (digital) - Wikipedia", desc: "a bookmark is a URI", note: "background reading", host: "en.wikipedia.org", tags: ["reference"] },
  { title: "Tagging: Usability Guidelines", desc: "how people use tags", note: "reusing existing tags", host: "nngroup.com", tags: ["design", "reading"] },
  { title: "Hacker News", desc: "social news computer science", note: "", host: "news.ycombinator.com", tags: ["news"] },
];
const run = (q) => Q.filter(items, q).map((i) => i.title);

test("tag search #reference (SCN-004)", () => {
  assert.deepEqual(run("#reference").sort(), ["Bookmark (digital) - Wikipedia", "Web APIs | MDN"].sort());
});
test("plain words are implicit AND", () => {
  assert.deepEqual(run("web api"), ["Web APIs | MDN"]);
});
test("exact phrase", () => {
  assert.deepEqual(run('"web apps"'), ["Web APIs | MDN"]);
});
test("OR", () => {
  assert.deepEqual(run("news OR design").sort(), ["Hacker News", "Tagging: Usability Guidelines"].sort());
});
test("NOT with tag", () => {
  assert.deepEqual(run("reference NOT #dev"), ["Bookmark (digital) - Wikipedia"]);
});
test("parentheses precedence", () => {
  assert.deepEqual(run("(news OR design) AND reading"), ["Tagging: Usability Guidelines"]);
});
test("searches inside notes", () => {
  assert.deepEqual(run("reusing"), ["Tagging: Usability Guidelines"]);
});
test("case-insensitive; lowercase and/or are plain words", () => {
  assert.deepEqual(run("REFERENCE").sort(), ["Bookmark (digital) - Wikipedia", "Web APIs | MDN"].sort());
  // lowercase "and" is a plain word (matches "handy" in a note), not an operator
  assert.deepEqual(run("and"), ["Web APIs | MDN"]);
});
test("no matches returns empty", () => {
  assert.deepEqual(run("zzzznomatch"), []);
});
