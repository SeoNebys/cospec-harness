import assert from "node:assert/strict";
import { test } from "./harness.mjs";
import { normalizeUrl, looksLikeLink, titleFromUrl } from "../js/model.js";
import { createLabelIndex } from "../js/labels.js";
import { tokenize, matches, highlightSegments } from "../js/search.js";
import { sortItems } from "../js/sort.js";
import { findDuplicate, visibleItems, VIEW, toReadCount, labelCount } from "../js/library.js";
import { parseBookmarksHtml, planImport, foldersToLabels } from "../js/importer.js";
import { buildBookmarksHtml } from "../js/exporter.js";

// ---- SCN-002 normalisation / dedup ----
test("SCN-002 tracking junk does not change identity", () => {
  assert.equal(
    normalizeUrl("https://bbc.com/news/world-report"),
    normalizeUrl("https://www.bbc.com/news/world-report?utm_source=email&fbclid=xyz")
  );
});
test("SCN-002 trailing slash and www ignored", () => {
  assert.equal(normalizeUrl("http://www.x.com/a/"), normalizeUrl("https://x.com/a"));
});
test("SCN-002 genuinely different pages stay distinct", () => {
  assert.notEqual(
    normalizeUrl("https://youtube.com/watch?v=aaa"),
    normalizeUrl("https://youtube.com/watch?v=bbb")
  );
});

// ---- SCN-009 non-link detection ----
test("SCN-009 gibberish is not a link; real url is", () => {
  assert.equal(looksLikeLink("asdf"), false);
  assert.equal(looksLikeLink("example.com/x"), true);
});

// ---- SCN-001/008 fallback title from url ----
test("readable title guessed from slug", () => {
  assert.equal(titleFromUrl("https://site.com/best-lemon-pasta.html"), "Best Lemon Pasta");
});

// ---- SCN-004/015 label case-insensitive reuse ----
test("SCN-004 label reuse ignores capitalisation", () => {
  const idx = createLabelIndex(["work", "recipes"]);
  assert.equal(idx.canon("Work"), "work");
  assert.equal(idx.canon("RECIPES"), "recipes");
  assert.equal(idx.isCaseMerge("Work"), true);
  assert.equal(idx.isCaseMerge("work"), false);
});
test("SCN-004 suggestions offer existing on partial type", () => {
  const idx = createLabelIndex(["recipes", "work"]);
  assert.deepEqual(idx.suggestions("recipe"), ["recipes"]);
});

// ---- SCN-006 search ----
test("SCN-006 multi-word AND, any order", () => {
  const it = { title: "The future of work", summary: "how remote and hybrid reshape the office" };
  assert.equal(matches(it, tokenize("remote office")), true);
  assert.equal(matches(it, tokenize("office remote")), true);
  assert.equal(matches(it, tokenize("remote spaceship")), false);
});
test("SCN-006 quotes require exact phrase", () => {
  const it = { title: "", summary: "remote and hybrid reshape the office" };
  assert.equal(matches(it, tokenize('"remote office"')), false);
  const it2 = { summary: "the remote office is here" };
  assert.equal(matches(it2, tokenize('"remote office"')), true);
});
test("SCN-013 search reaches the personal note", () => {
  const it = { title: "Lemon pasta", summary: "", note: "the mushroom bit is best" };
  assert.equal(matches(it, tokenize("mushroom")), true);
});
test("SCN-006 highlight marks matched runs", () => {
  const segs = highlightSegments("remote and office", tokenize("remote office"));
  const hits = segs.filter((s) => s.hit).map((s) => s.text.toLowerCase());
  assert.deepEqual(hits, ["remote", "office"]);
});

// ---- SCN-014 sort ----
test("SCN-014 sort orders", () => {
  const items = [
    { title: "B", savedAt: 200 },
    { title: "A", savedAt: 100 },
    { title: "C", savedAt: 300 },
  ];
  assert.deepEqual(sortItems(items, "new").map((i) => i.title), ["C", "B", "A"]);
  assert.deepEqual(sortItems(items, "old").map((i) => i.title), ["A", "B", "C"]);
  assert.deepEqual(sortItems(items, "az").map((i) => i.title), ["A", "B", "C"]);
});

// ---- SCN-002/005/007/012 library views ----
test("library duplicate + views", () => {
  const items = [
    { id: normalizeUrl("https://a.com/1"), labels: ["work"], toRead: true, archived: false },
    { id: normalizeUrl("https://b.com/2"), labels: ["work", "reading"], toRead: false, archived: false },
    { id: normalizeUrl("https://c.com/3"), labels: ["work"], toRead: true, archived: true },
  ];
  assert.ok(findDuplicate(items, "https://www.a.com/1/"));
  assert.equal(findDuplicate(items, "https://z.com/9"), null);
  // archived excluded from ALL, label, toread
  assert.equal(visibleItems(items, VIEW.ALL).length, 2);
  assert.equal(visibleItems(items, "work").length, 2); // the archived 'work' is hidden
  assert.equal(visibleItems(items, VIEW.TOREAD).length, 1);
  assert.equal(visibleItems(items, VIEW.ARCHIVED).length, 1);
  // multi-label link shows under each of its labels
  assert.equal(visibleItems(items, "reading").length, 1);
  assert.equal(toReadCount(items), 1);
  assert.equal(labelCount(items, "work"), 2);
});

// ---- SCN-015 import parsing + planning ----
const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Bookmarks bar</H3>
  <DL><p>
    <DT><H3>Recipes</H3>
    <DL><p>
      <DT><A HREF="https://cooking.nytimes.com/recipes/lemon-pasta/" ADD_DATE="1700000000">Lemon Pasta</A>
      <DT><H3>Italian</H3>
      <DL><p>
        <DT><A HREF="https://site.com/ragu" ADD_DATE="1600000000">Slow Ragu</A>
      </DL><p>
    </DL><p>
    <DT><H3>Work</H3>
    <DL><p>
      <DT><A HREF="https://github.com/acme/x" ADD_DATE="1650000000">Acme X</A>
    </DL><p>
  </DL><p>
  <DT><A HREF="https://root.com/loose">A root link</A>
</DL><p>`;

test("SCN-015 parse: nested folders, container skipped, add_date kept", () => {
  const parsed = parseBookmarksHtml(SAMPLE);
  const ragu = parsed.find((p) => p.url.includes("ragu"));
  assert.deepEqual(ragu.folders, ["Recipes", "Italian"]); // both levels, no 'Bookmarks bar'
  assert.equal(ragu.savedAt, 1600000000 * 1000);
  const loose = parsed.find((p) => p.url.includes("loose"));
  assert.deepEqual(loose.folders, []); // root link, and 'Bookmarks bar' not a folder here
});

test("SCN-015 plan: case-merge, nested labels, dupes skipped, titles kept", () => {
  const existing = [
    { id: normalizeUrl("https://cooking.nytimes.com/recipes/lemon-pasta"), labels: ["recipes"], title: "Lemon pasta" },
    { id: normalizeUrl("https://github.com/acme/x"), labels: ["work"], title: "Acme X (mine)" },
  ];
  const idx = createLabelIndex(existing.flatMap((e) => e.labels));
  const plan = planImport(parseBookmarksHtml(SAMPLE), existing, idx);
  // the two already-saved (lemon pasta w/ slash, acme x) are skipped
  assert.equal(plan.stats.dupes, 2);
  // 'Recipes' folder merges into existing lowercase 'recipes' (no new "Recipes")
  assert.ok(plan.stats.labels.includes("recipes"));
  assert.ok(!plan.stats.labels.includes("Recipes"));
  assert.ok(plan.stats.caseMerges >= 1);
  // ragu is fresh and carries BOTH nested levels as labels; "Recipes" merged into
  // the existing lowercase "recipes", while the brand-new "Italian" keeps its spelling
  const ragu = plan.fresh.find((f) => f.url.includes("ragu"));
  assert.deepEqual(ragu.labels.sort(), ["Italian", "recipes"]);
  // dates preserved for meaningful sort
  assert.equal(plan.stats.dateFrom, 1600000000 * 1000);
});

test("SCN-015 same url under two folders coalesces to one link, two labels", () => {
  const html = `<DL><p>
    <DT><H3>Work</H3><DL><p><DT><A HREF="https://x.com/a">A</A></DL><p>
    <DT><H3>Reading</H3><DL><p><DT><A HREF="https://x.com/a">A</A></DL><p>
  </DL><p>`;
  const idx = createLabelIndex([]);
  const plan = planImport(parseBookmarksHtml(html), [], idx);
  assert.equal(plan.fresh.length, 1);
  assert.deepEqual(plan.fresh[0].labels.sort(), ["Reading", "Work"]);
});

// ---- SCN-016 export + round-trip ----
test("SCN-016 export writes labels as folders and notes as DD", () => {
  const items = [
    { url: "https://a.com/1", title: "One", note: "my note", labels: ["work"], savedAt: 1700000000000 },
    { url: "https://b.com/2", title: "Two", note: "", labels: ["work", "recipes"], savedAt: 0 },
    { url: "https://c.com/3", title: "Three", note: "", labels: [], savedAt: 0 },
  ];
  const html = buildBookmarksHtml(items);
  assert.ok(/<H3>work<\/H3>/.test(html));
  assert.ok(/<H3>recipes<\/H3>/.test(html));
  assert.ok(/<DD>my note/.test(html));
  assert.ok(/ADD_DATE="1700000000"/.test(html));
});

test("SCN-016 round-trip: export then import restores labels", () => {
  const items = [
    { url: "https://a.com/1", title: "One", note: "n", labels: ["work"], savedAt: 0 },
    { url: "https://b.com/2", title: "Two", note: "", labels: ["recipes"], savedAt: 0 },
  ];
  const html = buildBookmarksHtml(items);
  const parsed = parseBookmarksHtml(html);
  const idx = createLabelIndex([]);
  const plan = planImport(parsed, [], idx);
  const one = plan.fresh.find((f) => f.url.includes("a.com"));
  assert.deepEqual(one.labels, ["work"]);
  assert.ok(plan.stats.labels.includes("recipes"));
});

test("foldersToLabels drops containers, keeps order, dedups", () => {
  const idx = createLabelIndex([]);
  assert.deepEqual(foldersToLabels(["Bookmarks bar", "Work", "Work"], idx), ["Work"]);
});
