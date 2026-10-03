import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

import {
  isValidUrl,
  normalizeUrl,
  deriveFallbackMeta,
  normalizeTags,
  matchesQuery,
  inView,
} from "../public/lib.js";
import { parseMetadata, fetchMetadata } from "../src/metadata.js";
import { Store } from "../src/store.js";
import { BookmarkService } from "../src/bookmarks.js";

function tempStore() {
  const file = join(tmpdir(), `bm-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return { store: new Store(file), cleanup: () => rmSync(file, { force: true }) };
}

// A service whose metadata "fetch" is controllable, so tests are deterministic.
function serviceWith(fetchMeta) {
  const { store, cleanup } = tempStore();
  return { svc: new BookmarkService(store, { fetchMeta }), cleanup };
}

// ---------------------------------------------------------------- lib (SCN-010)
test("isValidUrl accepts real links and rejects non-links (SCN-010)", () => {
  assert.ok(isValidUrl("https://example.com/x"));
  assert.ok(isValidUrl("example.com"));
  assert.ok(!isValidUrl("not a link"));
  assert.ok(!isValidUrl("notalink"));
  assert.ok(!isValidUrl(""));
});

// ---------------------------------------------------------------- lib (SCN-008)
test("normalizeUrl treats www/trailing slash as the same link (SCN-008)", () => {
  const a = normalizeUrl("https://www.github.com/");
  const b = normalizeUrl("github.com");
  assert.equal(a, b);
  assert.notEqual(normalizeUrl("github.com/a"), normalizeUrl("github.com/b"));
});

// ---------------------------------------------------------------- lib (SCN-001/010)
test("deriveFallbackMeta builds a usable name from the address (SCN-010)", () => {
  const m = deriveFallbackMeta("https://example.org/reports/2026/q1-summary");
  assert.equal(m.host, "example.org");
  assert.equal(m.title, "Q1 Summary");
  assert.equal(m.description, "");
});

// ---------------------------------------------------------------- lib (SCN-003)
test("normalizeTags lower-cases, trims and de-duplicates (SCN-003)", () => {
  assert.deepEqual(normalizeTags([" Reading ", "reading", "TECH", ""]), ["reading", "tech"]);
});

// ---------------------------------------------------------------- lib (SCN-002)
test("matchesQuery searches title/site/host/url/description/tags/note (SCN-002)", () => {
  const b = {
    title: "Sleep science", site: "NYT", host: "nytimes.com",
    url: "https://nytimes.com/x", description: "about rest",
    tags: ["health", "reading"], note: "check the folder idea",
  };
  assert.ok(matchesQuery(b, "sleep"));        // title
  assert.ok(matchesQuery(b, "reading"));      // tag
  assert.ok(matchesQuery(b, "folder"));       // note
  assert.ok(matchesQuery(b, "rest"));         // description
  assert.ok(matchesQuery(b, "sleep rest"));   // all words must match
  assert.ok(!matchesQuery(b, "sleep tennis")); // one word absent
});

// ---------------------------------------------------------------- lib (SCN-005/006)
test("inView splits all/toread/archived correctly (SCN-005/006)", () => {
  const active = { archived: false, toRead: false };
  const toread = { archived: false, toRead: true };
  const archived = { archived: true, toRead: false };
  assert.ok(inView(active, "all") && !inView(archived, "all"));
  assert.ok(inView(toread, "toread") && !inView(active, "toread"));
  assert.ok(inView(archived, "archived") && !inView(toread, "archived"));
});

// ---------------------------------------------------------------- metadata (SCN-001)
test("parseMetadata prefers og:title, reads description & site name (SCN-001)", () => {
  const html = `<html><head>
    <title>Fallback Title</title>
    <meta property="og:title" content="Real Title">
    <meta name="description" content="A short summary.">
    <meta property="og:site_name" content="Example Site">
  </head></html>`;
  const m = parseMetadata(html, "https://example.com/a");
  assert.equal(m.title, "Real Title");
  assert.equal(m.description, "A short summary.");
  assert.equal(m.site, "Example Site");
});

test("fetchMetadata falls back when the page cannot be fetched (SCN-010)", async () => {
  const failing = async () => { throw new Error("network down"); };
  const m = await fetchMetadata("https://example.org/reports/q1-summary", failing);
  assert.equal(m.title, "Q1 Summary"); // derived from address
});

// ---------------------------------------------------------------- service (SCN-001)
test("create saves a link with auto-filled details, newest first (SCN-001)", async () => {
  const { svc, cleanup } = serviceWith(async () => ({ host: "a.com", title: "Alpha", site: "A", description: "d" }));
  try {
    const r1 = await svc.create("https://a.com/1");
    const r2 = await svc.create("https://a.com/2");
    assert.ok(r1.ok && r2.ok);
    assert.equal(r1.bookmark.title, "Alpha");
    assert.equal(r1.bookmark.tags.length, 0);
    const list = svc.list();
    assert.equal(list[0].url, "https://a.com/2"); // newest first
  } finally { cleanup(); }
});

// ---------------------------------------------------------------- service (SCN-010)
test("create rejects invalid input (SCN-010)", async () => {
  const { svc, cleanup } = serviceWith(async () => ({ title: "x" }));
  try {
    const r = await svc.create("not a link");
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid");
    assert.equal(svc.list().length, 0);
  } finally { cleanup(); }
});

// ---------------------------------------------------------------- service (SCN-010)
test("create still saves when details can't be fetched (SCN-010)", async () => {
  // fetchMeta returns the address-derived fallback (as the real one does on failure)
  const { svc, cleanup } = serviceWith(async (url) => deriveFallbackMeta(url));
  try {
    const r = await svc.create("https://example.org/reports/2026/q1-summary");
    assert.ok(r.ok);
    assert.equal(r.bookmark.title, "Q1 Summary");
    assert.equal(r.bookmark.description, "");
  } finally { cleanup(); }
});

// ---------------------------------------------------------------- service (SCN-008)
test("create prevents duplicates and reports the existing one (SCN-008)", async () => {
  const { svc, cleanup } = serviceWith(async () => ({ host: "g.com", title: "G", site: "G", description: "" }));
  try {
    const first = await svc.create("https://www.github.com/");
    const dup = await svc.create("github.com"); // same link, different form
    assert.ok(first.ok);
    assert.equal(dup.ok, false);
    assert.equal(dup.code, "duplicate");
    assert.equal(dup.existing.id, first.bookmark.id);
    assert.equal(dup.archived, false);
    assert.equal(svc.list().length, 1);
  } finally { cleanup(); }
});

test("duplicate of an archived link reports archived=true (SCN-008)", async () => {
  const { svc, cleanup } = serviceWith(async () => ({ host: "g.com", title: "G", site: "G", description: "" }));
  try {
    const first = await svc.create("https://g.com/x");
    svc.update(first.bookmark.id, { archived: true });
    const dup = await svc.create("https://g.com/x");
    assert.equal(dup.code, "duplicate");
    assert.equal(dup.archived, true);
  } finally { cleanup(); }
});

// ---------------------------------------------------------------- service (SCN-009)
test("update edits title/description; blank title falls back to host (SCN-009)", async () => {
  const { svc, cleanup } = serviceWith(async () => ({ host: "ex.com", title: "Auto", site: "Ex", description: "" }));
  try {
    const { bookmark } = await svc.create("https://ex.com/page");
    let r = svc.update(bookmark.id, { title: "My Title", description: "My desc" });
    assert.equal(r.bookmark.title, "My Title");
    assert.equal(r.bookmark.description, "My desc");
    r = svc.update(bookmark.id, { title: "   " });
    assert.equal(r.bookmark.title, "ex.com"); // never nameless
  } finally { cleanup(); }
});

// ---------------------------------------------------------------- service (SCN-003/004)
test("update normalizes tags and trims trailing note whitespace (SCN-003/004)", async () => {
  const { svc, cleanup } = serviceWith(async () => ({ host: "ex.com", title: "T", site: "Ex", description: "" }));
  try {
    const { bookmark } = await svc.create("https://ex.com/p");
    const r = svc.update(bookmark.id, { tags: ["Reading", "reading", " NEWS "], note: "hello\n\n" });
    assert.deepEqual(r.bookmark.tags, ["reading", "news"]);
    assert.equal(r.bookmark.note, "hello");
  } finally { cleanup(); }
});

// ---------------------------------------------------------------- service (SCN-005/006)
test("read-later toggles; archiving clears the read-later mark (SCN-005/006)", async () => {
  const { svc, cleanup } = serviceWith(async () => ({ host: "ex.com", title: "T", site: "Ex", description: "" }));
  try {
    const { bookmark } = await svc.create("https://ex.com/p");
    let r = svc.update(bookmark.id, { toRead: true });
    assert.equal(r.bookmark.toRead, true);
    r = svc.update(bookmark.id, { archived: true });
    assert.equal(r.bookmark.archived, true);
    assert.equal(r.bookmark.toRead, false); // cleared on archive
    r = svc.update(bookmark.id, { archived: false });
    assert.equal(r.bookmark.archived, false);
  } finally { cleanup(); }
});

// ---------------------------------------------------------------- service (SCN-007)
test("remove deletes permanently (SCN-007)", async () => {
  const { svc, cleanup } = serviceWith(async () => ({ host: "ex.com", title: "T", site: "Ex", description: "" }));
  try {
    const { bookmark } = await svc.create("https://ex.com/p");
    assert.equal(svc.remove(bookmark.id).ok, true);
    assert.equal(svc.list().length, 0);
    assert.equal(svc.remove(bookmark.id).ok, false); // already gone
  } finally { cleanup(); }
});
