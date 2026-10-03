"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../src/store.js");
const { createService, ValidationError } = require("../src/service.js");

function mockFetcher() {
  return {
    async fetchAndPreserve(url) {
      if (/unreachable/i.test(url)) return { ok: false };
      if (/\.pdf($|[?#])/i.test(url)) return { ok: true, kind: "pdf", title: "PDF Document", desc: "", buffer: Buffer.from("%PDF-1.7") };
      const host = new URL(url).hostname.replace(/^www\./, "");
      return { ok: true, kind: "html", title: "Title of " + host, desc: "Desc of " + host, buffer: Buffer.from("<h1>copy of " + host + "</h1>") };
    },
  };
}

function freshService() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-"));
  const store = new Store(dir);
  const service = createService(store, mockFetcher());
  return { service, store, dir };
}

test("SCN-001 save enriches title/description and preserves a copy", async () => {
  const { service } = freshService();
  const it = await service.save("example.com/article");
  assert.equal(it.url, "https://example.com/article");
  assert.equal(it.host, "example.com");
  assert.equal(it.title, "Title of example.com");
  assert.equal(it.desc, "Desc of example.com");
  assert.equal(it.copy.status, "ok");
  assert.ok(it.capturedAt);
});

test("SCN-002 tags: add, reuse, lowercase, no duplicate, remove", async () => {
  const { service } = freshService();
  const it = await service.save("example.com");
  await service.addTag(it.id, "Dev");
  await service.addTag(it.id, "dev"); // duplicate/case
  let cur = service.get(it.id);
  assert.deepEqual(cur.tags, ["dev"]);
  await service.addTag(it.id, "reference");
  cur = service.get(it.id);
  assert.deepEqual(cur.tags, ["dev", "reference"]);
  await service.removeTag(it.id, "dev");
  cur = service.get(it.id);
  assert.deepEqual(cur.tags, ["reference"]);
});

test("SCN-003 note is stored and updatable", async () => {
  const { service } = freshService();
  const it = await service.save("example.com");
  await service.setNote(it.id, "**why** I saved this");
  assert.equal(service.get(it.id).note, "**why** I saved this");
  await service.setNote(it.id, "changed");
  assert.equal(service.get(it.id).note, "changed");
});

test("SCN-005 reading list is opt-in and mark-read is non-destructive", async () => {
  const { service } = freshService();
  const it = await service.save("example.com");
  assert.equal(it.toRead, false); // new links not auto-added
  await service.setToRead(it.id, true);
  assert.equal(service.get(it.id).toRead, true);
  await service.setToRead(it.id, false);
  assert.equal(service.get(it.id).toRead, false);
  assert.ok(service.get(it.id)); // still exists
});

test("SCN-006 archive hides then restores; nothing deleted", async () => {
  const { service } = freshService();
  const it = await service.save("example.com");
  await service.setArchived(it.id, true);
  assert.equal(service.get(it.id).archived, true);
  await service.setArchived(it.id, false);
  assert.equal(service.get(it.id).archived, false);
});

test("SCN-007 PDF preserved as pdf; copy retrievable", async () => {
  const { service } = freshService();
  const it = await service.save("https://x.org/spec.pdf");
  assert.equal(it.copy.kind, "pdf");
  const copy = service.getCopy(it.id);
  assert.equal(copy.kind, "pdf");
  assert.match(copy.buffer.toString(), /%PDF/);
});

test("SCN-008 duplicate on save is blocked", async () => {
  const { service } = freshService();
  await service.save("https://example.com/a");
  await assert.rejects(() => service.save("http://www.example.com/a/"), (e) => e instanceof ValidationError && e.code === "duplicate");
});

test("SCN-008 different query string is not a duplicate", async () => {
  const { service } = freshService();
  await service.save("https://example.com/a");
  const it2 = await service.save("https://example.com/a?x=1");
  assert.ok(it2.id);
});

test("SCN-008 edit title/description only keeps entered values", async () => {
  const { service } = freshService();
  const it = await service.save("example.com");
  await service.addTag(it.id, "keep");
  const edited = await service.edit(it.id, { title: "My Title", desc: "My Desc" });
  assert.equal(edited.title, "My Title");
  assert.equal(edited.desc, "My Desc");
  assert.deepEqual(edited.tags, ["keep"]); // tags preserved
});

test("SCN-008 changing address re-fetches details and keeps tags & note", async () => {
  const { service } = freshService();
  const it = await service.save("example.com");
  await service.addTag(it.id, "keep");
  await service.setNote(it.id, "my note");
  const edited = await service.edit(it.id, { title: "Ignored", desc: "Ignored", url: "https://other.org/x" });
  assert.equal(edited.host, "other.org");
  assert.equal(edited.title, "Title of other.org"); // re-fetched, not the entered "Ignored"
  assert.equal(edited.desc, "Desc of other.org");
  assert.deepEqual(edited.tags, ["keep"]);
  assert.equal(edited.note, "my note");
});

test("SCN-008 edit address to an existing one is blocked", async () => {
  const { service } = freshService();
  await service.save("https://a.com/x");
  const b = await service.save("https://b.com/y");
  await assert.rejects(() => service.edit(b.id, { url: "https://a.com/x" }), (e) => e.code === "duplicate");
});

test("SCN-008 delete removes the link and its copy", async () => {
  const { service } = freshService();
  const it = await service.save("example.com");
  assert.ok(service.getCopy(it.id));
  assert.equal(service.remove(it.id), true);
  assert.equal(service.get(it.id), null);
});

test("SCN-010 bulk actions apply only to selected ids", async () => {
  const { service } = freshService();
  const a = await service.save("https://a.com");
  const b = await service.save("https://b.com");
  const c = await service.save("https://c.com");
  service.bulk([a.id, b.id], "toread");
  assert.equal(service.get(a.id).toRead, true);
  assert.equal(service.get(b.id).toRead, true);
  assert.equal(service.get(c.id).toRead, false); // untouched
  service.bulk([a.id, b.id], "addTag", "batch");
  assert.deepEqual(service.get(a.id).tags, ["batch"]);
  assert.deepEqual(service.get(c.id).tags, []);
  service.bulk([a.id], "removeTag", "batch");
  assert.deepEqual(service.get(a.id).tags, []);
  service.bulk([a.id, b.id, c.id], "delete");
  assert.equal(service.list().length, 0);
});

test("SCN-011 non-address input is rejected", async () => {
  const { service } = freshService();
  await assert.rejects(() => service.save("hello world"), (e) => e.code === "not_a_url");
  await assert.rejects(() => service.save(""), (e) => e.code === "empty");
  assert.equal(service.list().length, 0);
});

test("SCN-011 unreachable page is still saved with copy unavailable, then retry succeeds", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-"));
  const store = new Store(dir);
  let reachable = false;
  const fetcher = {
    async fetchAndPreserve(url) {
      if (!reachable) return { ok: false };
      return { ok: true, kind: "html", title: "Now Available", desc: "d", buffer: Buffer.from("<h1>ok</h1>") };
    },
  };
  const service = createService(store, fetcher);
  const it = await service.save("https://example.com/page");
  assert.equal(it.copy.status, "unavailable");
  assert.equal(service.getCopy(it.id), null);
  assert.ok(service.get(it.id)); // still saved
  reachable = true;
  const retried = await service.retry(it.id);
  assert.equal(retried.copy.status, "ok");
  assert.equal(retried.title, "Now Available");
});

test("SCN-012 nothing changes state on its own (persistence across reload)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-"));
  let store = new Store(dir);
  let service = createService(store, mockFetcher());
  const it = await service.save("example.com");
  await service.setToRead(it.id, true);
  await service.setArchived(it.id, true);
  // Reload from disk — state is unchanged.
  store = new Store(dir);
  service = createService(store, mockFetcher());
  const reloaded = service.get(it.id);
  assert.equal(reloaded.toRead, true);
  assert.equal(reloaded.archived, true);
  assert.equal(reloaded.copy.status, "ok");
});
