import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuery, contextFor } from "../../src/query.js";

const data = [
  { title: "Rome in 3 Days — City Guide", description: "Forum, Pantheon", note: "", site: "guide.example.com", url: "https://guide.example.com/rome", tags: ["travel", "article"] },
  { title: "SPQR: A History of Ancient Rome", description: "Mary Beard", note: "", site: "books.example.com", url: "https://books.example.com/spqr", tags: ["book", "history"] },
  { title: "Rich Tonkotsu Ramen", description: "broth", note: "", site: "recipes.example.com", url: "https://recipes.example.com/ramen", tags: ["recipes", "cooking"] },
  { title: "CSS Grid Layout — MDN", description: "grid", note: "", site: "developer.mozilla.org", url: "https://developer.mozilla.org/css-grid", tags: ["reference", "frontend"] },
];

function run(q) {
  const { match, fallback } = buildQuery(q);
  return { titles: data.filter((d) => match(contextFor(d))).map((d) => d.title).sort(), fallback };
}

test("case-insensitive plain search", () => {
  assert.deepEqual(run("ROME").titles, ["Rome in 3 Days — City Guide", "SPQR: A History of Ancient Rome"]);
});

test("#tag matches the tag specifically", () => {
  assert.deepEqual(run("#recipes").titles, ["Rich Tonkotsu Ramen"]);
});

test("quoted phrase matches exact phrase", () => {
  assert.deepEqual(run('"ancient rome"').titles, ["SPQR: A History of Ancient Rome"]);
});

test("boolean with parentheses", () => {
  assert.deepEqual(run("rome AND (#article OR #book)").titles,
    ["Rome in 3 Days — City Guide", "SPQR: A History of Ancient Rome"]);
});

test("NOT excludes", () => {
  assert.deepEqual(run("rome AND NOT #book").titles, ["Rome in 3 Days — City Guide"]);
});

test("adjacent terms mean AND", () => {
  assert.deepEqual(run("rome book").titles, ["SPQR: A History of Ancient Rome"]);
});

test("quoted operator is literal text, not an operator", () => {
  // "OR" as literal -> substring 'or' appears in developer.mozilla.ORG etc.
  const { fallback } = run('"OR"');
  assert.equal(fallback, false);
});

test("malformed expression falls back to plain search", () => {
  const r = run("((rome");
  assert.equal(r.fallback, true);
});

test("empty query matches all", () => {
  assert.equal(run("").titles.length, data.length);
});
