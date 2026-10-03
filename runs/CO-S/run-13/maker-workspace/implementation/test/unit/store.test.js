import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, DuplicateError, NotFoundError, InvalidUrlError } from "../../src/store.js";

let dir, store;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bm-"));
  store = new Store(join(dir, "bookmarks.json"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("create stores a bookmark with defaults (SCN-001)", () => {
  const b = store.create({ url: "example.com/a", title: "A", tags: "x, y", note: "n" });
  assert.equal(b.url, "https://example.com/a");
  assert.equal(b.host, "example.com");
  assert.deepEqual(b.tags, ["x", "y"]);
  assert.equal(b.readLater, false);
  assert.equal(b.archived, false);
  assert.ok(b.savedAt > 0);
  assert.equal(store.list().length, 1);
});

test("title defaults to host when blank", () => {
  const b = store.create({ url: "https://example.com", title: "" });
  assert.equal(b.title, "example.com");
});

test("duplicate create is prevented and returns the existing one (SCN-009)", () => {
  const first = store.create({ url: "https://example.com/x", title: "First" });
  try {
    store.create({ url: "example.com/x", title: "Second" });
    assert.fail("expected DuplicateError");
  } catch (e) {
    assert.ok(e instanceof DuplicateError);
    assert.equal(e.existing.id, first.id);
  }
  assert.equal(store.list().length, 1);
});

test("invalid url on create throws (SCN-010)", () => {
  assert.throws(() => store.create({ url: "not a url", title: "x" }), InvalidUrlError);
});

test("update edits fields and de-duplicates tags (SCN-008)", () => {
  const b = store.create({ url: "https://example.com", title: "T" });
  const u = store.update(b.id, { title: "New", tags: "a, a, B", note: "hi" });
  assert.equal(u.title, "New");
  assert.deepEqual(u.tags, ["a", "B"]);
  assert.equal(u.note, "hi");
});

test("editing the address updates host/site and clears stale image/icon (SCN-008)", () => {
  const b = store.create({ url: "https://example.com/old", title: "T", image: "https://x/i.png", icon: "https://x/f.ico", site: "Example" });
  const u = store.update(b.id, { url: "https://elsewhere.org/new" });
  assert.equal(u.host, "elsewhere.org");
  assert.equal(u.site, "elsewhere.org");
  assert.equal(u.image, null);
  assert.equal(u.icon, null);
});

test("editing address to one another bookmark uses is blocked (SCN-008)", () => {
  const a = store.create({ url: "https://a.com", title: "A" });
  const b = store.create({ url: "https://b.com", title: "B" });
  assert.throws(() => store.update(b.id, { url: "https://a.com" }), DuplicateError);
  // a is unchanged, b still exists
  assert.equal(store.get(a.id).url, "https://a.com/");
});

test("readLater and archived toggle (SCN-006, SCN-007)", () => {
  const b = store.create({ url: "https://example.com", title: "T" });
  assert.equal(store.update(b.id, { readLater: true }).readLater, true);
  assert.equal(store.update(b.id, { archived: true }).archived, true);
});

test("update of a missing bookmark throws NotFound", () => {
  assert.throws(() => store.update(999, { title: "x" }), NotFoundError);
});

test("data persists across store instances (nothing gets lost)", () => {
  const b = store.create({ url: "https://persist.com", title: "P", tags: "keep" });
  const reopened = new Store(join(dir, "bookmarks.json"));
  const all = reopened.list();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, b.id);
  assert.equal(all[0].title, "P");
});
