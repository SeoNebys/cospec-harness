import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatcher, toRecord } from "../../public/search.mjs";

const data = [
  { title: "The Practical Test Pyramid", description: "unit service UI layers", note: "balance unit vs UI tests", url: "https://martinfowler.com/x", host: "martinfowler.com", tags: ["testing", "engineering"] },
  { title: "A Complete Guide to CSS Grid", description: "CSS Grid layout examples", note: "", url: "https://smashingmagazine.com/x", host: "smashingmagazine.com", tags: ["css", "frontend", "reference"] },
  { title: "10 Usability Heuristics", description: "Nielsen principles", note: "revisit before the redesign", url: "https://nngroup.com/x", host: "nngroup.com", tags: ["design", "reference", "read-later"] },
  { title: "Write tests. Not too many.", description: "how many tests to write", note: "", url: "https://kentcdodds.com/x", host: "kentcdodds.com", tags: ["testing", "frontend"] },
];

function run(q) {
  const m = buildMatcher(q);
  if (m === null) return data.map((b) => b.title);
  return data.filter((b) => m(toRecord(b))).map((b) => b.title);
}

test("empty query returns null matcher", () => {
  assert.equal(buildMatcher(""), null);
  assert.equal(buildMatcher("   "), null);
});

test("plain word is case-insensitive and loose", () => {
  assert.deepEqual(run("TEST"), ["The Practical Test Pyramid", "Write tests. Not too many."]);
});

test("#tag matches exactly", () => {
  assert.deepEqual(run("#frontend"), ["A Complete Guide to CSS Grid", "Write tests. Not too many."]);
});

test("#tag does not match a partial tag name", () => {
  // "#test" must NOT match the tag "testing"
  assert.deepEqual(run("#test"), []);
});

test("implicit and explicit AND", () => {
  assert.deepEqual(run("testing AND #frontend"), ["Write tests. Not too many."]);
  assert.deepEqual(run("tests #frontend"), ["Write tests. Not too many."]);
});

test("OR", () => {
  assert.deepEqual(run("css OR design"), ["A Complete Guide to CSS Grid", "10 Usability Heuristics"]);
});

test("NOT excludes", () => {
  assert.deepEqual(run("reference NOT #design"), ["A Complete Guide to CSS Grid"]);
});

test("dash is a NOT shorthand", () => {
  assert.deepEqual(run("reference -#design"), ["A Complete Guide to CSS Grid"]);
});

test("parentheses group", () => {
  assert.deepEqual(run("(css OR design) AND reference"), ["A Complete Guide to CSS Grid", "10 Usability Heuristics"]);
});

test("quoted phrase is an exact substring", () => {
  assert.deepEqual(run('"how many tests"'), ["Write tests. Not too many."]);
  assert.deepEqual(run('"tests how many"'), []);
});

test("searches url and host too", () => {
  assert.deepEqual(run("nngroup.com"), ["10 Usability Heuristics"]);
});
