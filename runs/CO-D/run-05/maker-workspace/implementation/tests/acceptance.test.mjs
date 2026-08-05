// Gherkin-based acceptance tests for the behaviour engine (store.js) behind the
// UI scenarios. Runs headless via a localStorage shim. Purely-visual details
// (spinner, toast linger, inline-error styling, empty-state copy) are confirmed
// with the client in the browser during Phase 4.
import assert from "node:assert/strict";
import { test } from "./harness.mjs";

// minimal localStorage for Node
globalThis.localStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
})();

const { createStore } = await import("../js/store.js");
const { visibleItems, VIEW } = await import("../js/library.js");
const fresh = () => { localStorage.clear(); return createStore(); };

// SCN-001 paste → entry, newest on top; metadata fills in
test("SCN-001 save adds a resolving entry, newest on top; resolution fills title", () => {
  const s = fresh();
  s.addFromUrl("https://a.com/one");
  const r = s.addFromUrl("https://b.com/two");
  assert.equal(s.items[0].id, r.item.id); // newest first
  assert.equal(r.item.resolving, true);
  s.applyResolution(r.item.id, { ok: true, title: "Two!", summary: "a summary" });
  assert.equal(s.items[0].title, "Two!");
  assert.equal(s.items[0].resolving, false);
});

// SCN-002 duplicate paste doesn't add a copy
test("SCN-002 re-saving the same page returns the existing one, no copy", () => {
  const s = fresh();
  s.addFromUrl("https://bbc.com/news/x");
  const again = s.addFromUrl("https://www.bbc.com/news/x?utm_source=email");
  assert.equal(again.status, "duplicate");
  assert.equal(s.items.length, 1);
});

// SCN-003 edit title/summary/note
test("SCN-003 editing updates fields", () => {
  const s = fresh();
  const { item } = s.addFromUrl("https://a.com/x");
  s.update(item.id, { title: "My name", summary: "sum", note: "note" });
  assert.equal(s.items[0].title, "My name");
  assert.equal(s.items[0].note, "note");
});

// SCN-007 to-read state + check off + undo + sticky pref
test("SCN-007 to-read, check off, undo, sticky save pref", () => {
  const s = fresh();
  const { item } = s.addFromUrl("https://a.com/x", { toRead: true });
  assert.equal(visibleItems(s.items, VIEW.TOREAD).length, 1);
  s.setRead(item.id, true);
  assert.equal(s.items[0].toRead, false);
  assert.equal(visibleItems(s.items, VIEW.TOREAD).length, 0); // left the pile
  s.setRead(item.id, false); s.setToRead(item.id, true);
  assert.equal(visibleItems(s.items, VIEW.TOREAD).length, 1); // undo returns it
  s.setSavePref(true);
  const s2 = createStore(); // reload
  assert.equal(s2.savePref.toRead, true);
});

// SCN-008 unreadable page → kept, flagged, address as title
test("SCN-008 failed resolution keeps the link and flags it", () => {
  const s = fresh();
  const { item } = s.addFromUrl("https://dead.example/gone");
  s.applyResolution(item.id, { ok: false });
  assert.equal(s.items.length, 1); // never lost
  assert.equal(s.items[0].needsName, true);
  assert.equal(s.items[0].title, s.items[0].url);
});

// SCN-011 delete + undo restores at position
test("SCN-011 delete returns undo info; restore puts it back in place", () => {
  const s = fresh();
  s.addFromUrl("https://a.com/1"); const mid = s.addFromUrl("https://b.com/2").item; s.addFromUrl("https://c.com/3");
  const removed = s.remove(mid.id);
  assert.equal(s.items.find((i) => i.id === mid.id), undefined);
  s.restore(removed.item, removed.index);
  assert.equal(s.items[removed.index].id, mid.id);
});

// SCN-012 put away hides from normal views, kept in archived; clears to-read
test("SCN-012 put away hides everywhere but the back room", () => {
  const s = fresh();
  const { item } = s.addFromUrl("https://a.com/x", { toRead: true });
  s.update(item.id, { labels: ["work"] });
  s.setArchived(item.id, true);
  assert.equal(visibleItems(s.items, VIEW.ALL).length, 0);
  assert.equal(visibleItems(s.items, "work").length, 0);
  assert.equal(visibleItems(s.items, VIEW.TOREAD).length, 0);
  assert.equal(visibleItems(s.items, VIEW.ARCHIVED).length, 1);
  assert.equal(s.items[0].toRead, false); // put-away clears to-read
  s.setArchived(item.id, false);
  assert.equal(visibleItems(s.items, VIEW.ALL).length, 1); // put back
});

// persistence across reloads
test("bookmarks persist across a reload", () => {
  const s = fresh();
  s.addFromUrl("https://a.com/keep");
  const s2 = createStore();
  assert.equal(s2.items.length, 1);
  assert.equal(s2.items[0].url.includes("keep"), true);
});

// SCN-016 export via store reflects current collection
test("SCN-016 store export produces a bookmarks file with the links", () => {
  const s = fresh();
  const { item } = s.addFromUrl("https://a.com/x");
  s.update(item.id, { title: "Kept", labels: ["work"], note: "n" });
  const html = s.exportHtml();
  assert.ok(html.includes("<H3>work</H3>"));
  assert.ok(html.includes("Kept"));
});
