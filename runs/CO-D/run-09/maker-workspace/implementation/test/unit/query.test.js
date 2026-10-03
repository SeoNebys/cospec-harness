const test = require("node:test");
const assert = require("node:assert");
const Q = require("../../public/query.js");

const data = [
  { id: 5, domain: "github.com", url: "https://github.com/sindresorhus/awesome", title: "sindresorhus/awesome", desc: "Curated resources", note: "", tags: ["tools"] },
  { id: 4, domain: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/Spaced_repetition", title: "Spaced repetition — Wikipedia", desc: "A learning technique", note: "Try this for language study", tags: ["learning"] },
  { id: 3, domain: "nytimes.com", url: "https://www.nytimes.com/reading-slowly", title: "The Quiet Power of Reading Slowly", desc: "unhurried reading", note: "", tags: ["reading"] },
  { id: 2, domain: "developer.mozilla.org", url: "https://developer.mozilla.org/reduce", title: "Array.prototype.reduce() — MDN", desc: "reducer function", note: "", tags: ["javascript", "reference"] },
  { id: 1, domain: "smashingmagazine.com", url: "https://www.smashingmagazine.com/calm-interfaces", title: "Designing Calm Interfaces", desc: "respects attention", note: "", tags: ["reading", "design"] },
];
const run = (q) => { const c = Q.compile(q); return data.filter((b) => c.match(b)).map((b) => b.id); };

test("SCN-006: word matches across fields, case-insensitive", () => {
  assert.deepEqual(run("reading").sort(), [1, 3].sort());
  assert.deepEqual(run("Reading").sort(), [1, 3].sort());
  assert.deepEqual(run("language").sort(), [4]); // only in a note
});
test("SCN-006: multiple words narrow (implicit AND)", () => {
  assert.deepEqual(run("reading design"), [1]);
});
test("SCN-006: no matches", () => {
  assert.deepEqual(run("zzznope"), []);
});
test("SCN-007: #label is exact label match", () => {
  assert.deepEqual(run("#learning"), [4]);
  assert.deepEqual(run("#reading").sort(), [1, 3].sort());
});
test("SCN-007: quoted phrase", () => {
  assert.deepEqual(run('"spaced repetition"'), [4]);
});
test("SCN-007: OR / NOT / parentheses", () => {
  assert.deepEqual(run("#reading OR #learning").sort(), [1, 3, 4].sort());
  assert.deepEqual(run("#reading NOT design"), [3]);
  assert.deepEqual(run("(#javascript OR #learning)").sort(), [2, 4].sort());
});
test("SCN-007: operators are case-insensitive", () => {
  assert.deepEqual(run("#reading or #learning").sort(), run("#reading OR #learning").sort());
  assert.deepEqual(run("#reading not design"), run("#reading NOT design"));
});
test("SCN-007: quoted operator is literal text", () => {
  // "or" as text matches any bookmark containing the substring 'or'
  const ids = run('"or"');
  assert.ok(ids.length >= 1);
});
test("SCN-007: highlights exclude negated terms", () => {
  const c = Q.compile("reading NOT design");
  assert.ok(c.highlights.includes("reading"));
  assert.ok(!c.highlights.includes("design"));
});
