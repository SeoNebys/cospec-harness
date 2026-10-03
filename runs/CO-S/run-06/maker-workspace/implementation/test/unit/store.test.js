import { test } from "node:test";
import assert from "node:assert/strict";
import { Store, coerceUrl, normalizeUrl } from "../../src/store.js";

test("coerceUrl accepts and canonicalises links, rejects non-links", () => {
  assert.equal(coerceUrl("https://example.com"), "https://example.com/");
  assert.equal(coerceUrl("example.com/path"), "https://example.com/path");
  assert.equal(coerceUrl("not a url"), null);
  assert.equal(coerceUrl(""), null);
  assert.equal(coerceUrl("ftp://example.com"), null);
  assert.equal(coerceUrl("nodots"), null);
});

test("normalizeUrl ignores case and trailing slashes (SCN-007)", () => {
  assert.equal(normalizeUrl("https://EXAMPLE.com/a/"), normalizeUrl("https://example.com/a"));
});

test("create prepends newest and falls back to URL as title (SCN-001/006)", () => {
  const s = new Store(null);
  s.create({ url: "https://a.com/", title: "A", tags: ["x"] });
  const b = s.create({ url: "https://b.com/", title: "", tags: [] });
  assert.equal(s.list()[0].url, "https://b.com/");
  assert.equal(b.title, "https://b.com/"); // fallback
  assert.equal(s.list()[0].later, false);
  assert.equal(s.list()[0].archived, false);
});

test("duplicate detection via findByUrl (SCN-007)", () => {
  const s = new Store(null);
  s.create({ url: "https://a.com/", title: "A" });
  assert.ok(s.findByUrl("https://A.com"));
  assert.equal(s.findByUrl("https://c.com"), null);
});

test("tags are cleaned: trimmed, de-duped, # stripped", () => {
  const s = new Store(null);
  const it = s.create({ url: "https://a.com/", tags: [" #Design ", "design", "", "reference"] });
  assert.deepEqual(it.tags, ["Design", "reference"]);
});

test("search matches across title, note, url and tags (SCN-002)", () => {
  const s = new Store(null);
  s.create({ url: "https://stripe.com/docs", title: "Payments", note: "billing rework", tags: ["ref"] });
  s.create({ url: "https://figma.com/", title: "Figma", note: "", tags: ["design"] });
  assert.equal(s.list({ q: "billing" }).length, 1); // from note
  assert.equal(s.list({ q: "stripe" }).length, 1); // from url
  assert.equal(s.list({ q: "design" }).length, 1); // from tag
  assert.equal(s.list({ q: "zzz" }).length, 0);
});

test("read-later view is separate and reversible (SCN-003)", () => {
  const s = new Store(null);
  const a = s.create({ url: "https://a.com/", title: "A" });
  assert.equal(s.list({ view: "later" }).length, 0);
  s.setLater(a.id, true);
  assert.equal(s.list({ view: "later" }).length, 1);
  s.setLater(a.id, false);
  assert.equal(s.list({ view: "later" }).length, 0);
});

test("archive removes from all/later but stays searchable & restorable (SCN-004)", () => {
  const s = new Store(null);
  const a = s.create({ url: "https://a.com/", title: "Alpha", tags: ["t"] });
  s.setLater(a.id, true);
  s.setArchived(a.id, true);
  assert.equal(s.list({ view: "all" }).length, 0);
  assert.equal(s.list({ view: "later" }).length, 0);
  assert.equal(s.list({ view: "archive" }).length, 1);
  assert.equal(s.list({ view: "archive", q: "alpha" }).length, 1); // searchable in archive
  s.setArchived(a.id, false);
  assert.equal(s.list({ view: "all" }).length, 1);
  assert.equal(s.list({ view: "later" }).length, 1); // later state preserved
});

test("update edits in place, preserves identity and state (SCN-007)", () => {
  const s = new Store(null);
  const a = s.create({ url: "https://a.com/", title: "Old" });
  s.setLater(a.id, true);
  const updated = s.update(a.id, { title: "New", note: "n", tags: ["z"] });
  assert.equal(updated.id, a.id);
  assert.equal(updated.title, "New");
  assert.equal(updated.later, true);
  assert.equal(s.list().length, 1); // no copy created
});

test("tagsForView reflects only that view's items", () => {
  const s = new Store(null);
  const a = s.create({ url: "https://a.com/", tags: ["keep"] });
  s.setArchived(a.id, true);
  s.create({ url: "https://b.com/", tags: ["active"] });
  assert.deepEqual(s.tagsForView("all"), ["active"]);
  assert.deepEqual(s.tagsForView("archive"), ["keep"]);
});
