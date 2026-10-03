import { test } from "node:test";
import assert from "node:assert/strict";
import { compileQuery } from "../src/query.js";
import { renderNote } from "../src/notes.js";
import { exportNetscape, importNetscape } from "../src/netscape.js";
import { normalizeInput, urlKey, isPdf } from "../src/normalize.js";

const bm = (o) => ({ title: "", description: "", note: "", url: "", tags: [], ...o });
const run = (list, q) => { const cq = compileQuery(q); return cq.error ? { error: cq.error } : list.filter((b) => cq.test(b)); };

const DATA = [
  bm({ title: "A Complete Guide to Flexbox", description: "flexbox layout", note: "cheat", url: "https://css-tricks.com/flexbox", tags: ["css", "layout", "reference"] }),
  bm({ title: "Stripe", description: "payments api", note: "billing docs", url: "https://stripe.com", tags: ["payments", "api", "reference"] }),
  bm({ title: "A Walking Tour of Ancient Rome", description: "rome article", note: "trip", url: "https://atlasobscura.com/rome", tags: ["travel", "article", "history"] }),
  bm({ title: "Decline and Fall of the Roman Empire", description: "fall of rome", note: "", url: "https://gutenberg.org/731", tags: ["history", "book"] }),
];

test("SCN-004 plain word matches across fields, case-insensitive", () => {
  assert.equal(run(DATA, "FLEXBOX").length, 1);
  assert.equal(run(DATA, "billing")[0].title, "Stripe"); // matches note only
});

test("SCN-004 #tag is exact, unlike plain word", () => {
  assert.equal(run(DATA, "#reference").length, 2);
  const cq = compileQuery("#css");
  assert.ok(cq.test(bm({ tags: ["css"] })));
  assert.ok(!cq.test(bm({ tags: ["css-frameworks"] })));
});

test("SCN-004 implicit AND, phrases, boolean, parens", () => {
  assert.equal(run(DATA, "flexbox #css").length, 1);
  assert.equal(run(DATA, '"fall of rome"').length, 1);
  assert.equal(run(DATA, "rome (#article OR #book)").length, 2);
  assert.equal(run(DATA, "rome NOT #book").length, 1);
});

test("SCN-004 quoted operator is literal text", () => {
  const cq = compileQuery('"OR"');
  assert.ok(!cq.error);
  assert.ok(cq.test(bm({ url: "https://example.org/x" }))); // ".org" contains "or"
});

test("SCN-004 malformed parentheses are a hard error", () => {
  assert.match(run(DATA, "rome (#article OR #book").error, /parenthesis/);
  assert.match(run(DATA, "rome #book)").error, /closing parenthesis/);
  assert.ok(!compileQuery("rome (#article OR #book)").error);
});

test("SCN-014 note formatting renders all block types and escapes markup", () => {
  const html = renderNote("# Big\nintro\n1. one\n2. two\n> quoted\n- b1\n`code` and **bold** and *it* and [x](https://a.com)");
  for (const tag of ["<h4", "<ol>", "<blockquote>", "<ul>", "<code>", "<strong>", "<em>", "<a "]) assert.ok(html.includes(tag), "missing " + tag);
  assert.ok(renderNote("<script>alert(1)</script>").includes("&lt;script&gt;"));
});

test("SCN-003/009 url normalization and identity", () => {
  assert.ok(!normalizeInput("just some words").ok);
  assert.ok(normalizeInput("example.org/page").ok);
  assert.equal(normalizeInput("example.org/page").url, "https://example.org/page");
  assert.equal(urlKey("https://Example.com/page/"), urlKey("http://www.example.com/page"));
  assert.equal(urlKey("https://example.com/page/"), "example.com/page");
  assert.ok(isPdf("https://x.com/a.pdf"));
  assert.ok(!isPdf("https://x.com/a.html"));
});

test("SCN-017 export/import round-trip preserves details and archived status", () => {
  const src = [
    { url: "https://a.com/x", title: "Alpha", description: "desc a", tags: ["one", "two"], addedAt: 1600000000000, archived: false },
    { url: "https://b.com/y", title: "Beta", description: "", tags: ["three"], addedAt: 1600000500000, archived: true },
  ];
  const html = exportNetscape(src);
  assert.ok(html.includes("NETSCAPE-Bookmark-file-1"));
  assert.ok(html.includes("<H3>Archived</H3>"));
  const back = importNetscape(html);
  assert.equal(back.length, 2);
  const a = back.find((x) => x.url === "https://a.com/x");
  const b = back.find((x) => x.url === "https://b.com/y");
  assert.deepEqual(a.tags, ["one", "two"]);
  assert.equal(a.description, "desc a");
  assert.equal(a.addedAt, 1600000000000);
  assert.equal(a.archived, false);
  assert.equal(b.archived, true); // restored from the Archived folder
});

test("SCN-017 import skips non-web entries", () => {
  const html = '<DL><p><DT><A HREF="javascript:void(0)">bad</A><DT><A HREF="https://ok.com">good</A></DL>';
  const out = importNetscape(html);
  assert.equal(out.length, 1);
  assert.equal(out[0].url, "https://ok.com");
});
