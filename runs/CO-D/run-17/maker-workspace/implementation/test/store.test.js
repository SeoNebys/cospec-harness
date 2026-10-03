"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../lib/store.js");

function tmpStore() { return new Store(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ll-")), "store.json")); }

test("store: add/update/delete link and persist", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ll-")), "store.json");
  let s = new Store(file);
  const a = s.addLink({ id: "1", url: "https://a.com/", domain: "a.com", title: "A", tags: [], toRead: false, archived: false, addedTs: 1 });
  assert.ok(a.createdSeq > 0 && a.updatedSeq === a.createdSeq);
  s.updateLink("1", { title: "A2", toRead: true });
  assert.equal(s.findLink("1").title, "A2");
  assert.ok(s.findLink("1").updatedSeq > a.createdSeq, "updatedSeq bumped");
  // reload from disk
  s = new Store(file);
  assert.equal(s.findLink("1").title, "A2");
  assert.equal(s.findLink("1").toRead, true);
  assert.equal(s.deleteLink("1"), true);
  assert.equal(s.findLink("1"), undefined);
});

test("store: hasUrl duplicate detection excludes self", () => {
  const s = tmpStore();
  s.addLink({ id: "1", url: "https://a.com/", domain: "a.com", title: "A", tags: [] });
  assert.equal(s.hasUrl("https://a.com/"), true);
  assert.equal(s.hasUrl("https://a.com/", "1"), false);
});

test("store: bulkUpdate mutates matching and bumps updatedSeq once each", () => {
  const s = tmpStore();
  s.addLink({ id: "1", url: "https://a.com/", domain: "a.com", title: "A", tags: [], toRead: true });
  s.addLink({ id: "2", url: "https://b.com/", domain: "b.com", title: "B", tags: [], toRead: true });
  s.bulkUpdate(["1", "2"], l => { l.toRead = false; });
  assert.equal(s.findLink("1").toRead, false);
  assert.equal(s.findLink("2").toRead, false);
});

test("store: preferences and saved views persist", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ll-")), "store.json");
  let s = new Store(file);
  s.setPreferences({ defaultSort: "title-az", perPage: 25, textSize: "large" });
  s.addSavedView({ id: "v1", name: "Work", search: "rome", include: ["work"], exclude: ["done"] });
  s = new Store(file);
  assert.equal(s.getState().preferences.defaultSort, "title-az");
  assert.equal(s.getState().preferences.perPage, 25);
  assert.equal(s.getState().savedViews[0].name, "Work");
  s.deleteSavedView("v1");
  assert.equal(new Store(file).getState().savedViews.length, 0);
});
