"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../src/store.js");
const { createService } = require("../src/service.js");
const { createApp } = require("../src/app.js");

function mockFetcher() {
  return {
    async fetchAndPreserve(url) {
      if (/unreachable/i.test(url)) return { ok: false };
      const host = new URL(url).hostname.replace(/^www\./, "");
      return { ok: true, kind: "html", title: "Title of " + host, desc: "Desc", buffer: Buffer.from("<h1>copy</h1>") };
    },
  };
}

async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-api-"));
  const service = createService(new Store(dir), mockFetcher());
  const server = createApp(service);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try { await fn(base); } finally { await new Promise((r) => server.close(r)); }
}

const j = (res) => res.json();

test("GET empty library then POST creates and lists (SCN-001)", async () => {
  await withServer(async (base) => {
    let r = await fetch(base + "/api/bookmarks");
    assert.deepEqual((await j(r)).items, []);

    r = await fetch(base + "/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "example.com/a" }) });
    assert.equal(r.status, 201);
    const item = (await j(r)).item;
    assert.equal(item.title, "Title of example.com");

    r = await fetch(base + "/api/bookmarks");
    assert.equal((await j(r)).items.length, 1);
  });
});

test("POST rejects non-address (400) and duplicate (409) (SCN-008/011)", async () => {
  await withServer(async (base) => {
    let r = await fetch(base + "/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "hello world" }) });
    assert.equal(r.status, 400);
    assert.equal((await j(r)).error, "not_a_url");

    await fetch(base + "/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://dup.com/x" }) });
    r = await fetch(base + "/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "http://www.dup.com/x/" }) });
    assert.equal(r.status, 409);
    const d = await j(r);
    assert.equal(d.error, "duplicate");
    assert.ok(d.existing && d.existing.id);
  });
});

test("PATCH flags, tags, note, retry, copy, delete (SCN-002/003/005/006/007/011)", async () => {
  await withServer(async (base) => {
    const create = await (await fetch(base + "/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "example.com" }) })).json();
    const id = create.item.id;

    // reading list + archive flags
    await fetch(base + "/api/bookmarks/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toRead: true }) });
    let item = (await (await fetch(base + "/api/bookmarks")).json()).items[0];
    assert.equal(item.toRead, true);

    // tag add/remove
    await fetch(base + "/api/bookmarks/" + id + "/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag: "Dev" }) });
    item = (await (await fetch(base + "/api/bookmarks")).json()).items[0];
    assert.deepEqual(item.tags, ["dev"]);
    await fetch(base + "/api/bookmarks/" + id + "/untag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag: "dev" }) });
    item = (await (await fetch(base + "/api/bookmarks")).json()).items[0];
    assert.deepEqual(item.tags, []);

    // note
    await fetch(base + "/api/bookmarks/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: "hi" }) });
    item = (await (await fetch(base + "/api/bookmarks")).json()).items[0];
    assert.equal(item.note, "hi");

    // copy served
    const copyRes = await fetch(base + "/api/bookmarks/" + id + "/copy");
    assert.equal(copyRes.status, 200);
    assert.match(await copyRes.text(), /copy/);

    // delete
    const del = await fetch(base + "/api/bookmarks/" + id, { method: "DELETE" });
    assert.equal(del.status, 200);
    assert.equal((await (await fetch(base + "/api/bookmarks")).json()).items.length, 0);
  });
});

test("unreachable page saved with no copy; copy endpoint 404 (SCN-011)", async () => {
  await withServer(async (base) => {
    const create = await (await fetch(base + "/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://unreachable.example.com/p" }) })).json();
    assert.equal(create.item.copy.status, "unavailable");
    const copyRes = await fetch(base + "/api/bookmarks/" + create.item.id + "/copy");
    assert.equal(copyRes.status, 404);
  });
});

test("bulk endpoint applies to ids only (SCN-010)", async () => {
  await withServer(async (base) => {
    const a = (await (await fetch(base + "/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://a.com" }) })).json()).item;
    const b = (await (await fetch(base + "/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://b.com" }) })).json()).item;
    await fetch(base + "/api/bookmarks/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [a.id], action: "archive" }) });
    const items = (await (await fetch(base + "/api/bookmarks")).json()).items;
    assert.equal(items.find((x) => x.id === a.id).archived, true);
    assert.equal(items.find((x) => x.id === b.id).archived, false);
  });
});

test("serves the app shell at / (SCN presentation)", async () => {
  await withServer(async (base) => {
    const r = await fetch(base + "/");
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Link Library/);
  });
});
