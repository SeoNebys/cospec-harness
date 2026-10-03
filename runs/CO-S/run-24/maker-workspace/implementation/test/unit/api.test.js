import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { createHttpServer } from "../../src/app.js";
import { Store } from "../../src/store.js";

// Stub page-info: a special host fails (SCN-006), others succeed (SCN-001).
function stubInfo(url) {
  if (url.includes("private.example")) return Promise.resolve({ title: "", description: "", ok: false });
  return Promise.resolve({ title: "Stub Title", description: "Stub description", ok: true });
}

async function withServer(run) {
  const dir = await mkdtemp(join(tmpdir(), "bm-"));
  const store = new Store(join(dir, "links.json"));
  await store.load();
  const server = createHttpServer({ store, fetchInfo: stubInfo });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
  } finally {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
}

const post = (base, url) =>
  fetch(base + "/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
const patch = (base, id, body) =>
  fetch(`${base}/api/links/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("POST saves a link and auto-fills details (SCN-001)", async () => {
  await withServer(async (base) => {
    const r = await post(base, "example.com/article");
    assert.equal(r.status, 201);
    const { link } = await r.json();
    assert.equal(link.url, "https://example.com/article");
    assert.equal(link.title, "Stub Title");
    assert.equal(link.description, "Stub description");
    assert.equal(link.autoFailed, false);
    assert.deepEqual(link.tags, []);
    assert.equal(link.inList, false);
  });
});

test("POST of a failing page still saves with autoFailed (SCN-006)", async () => {
  await withServer(async (base) => {
    const r = await post(base, "https://private.example.com/report");
    assert.equal(r.status, 201);
    const { link } = await r.json();
    assert.equal(link.title, "");
    assert.equal(link.autoFailed, true);
  });
});

test("POST rejects non-link text and empty input (SCN-008)", async () => {
  await withServer(async (base) => {
    const bad = await post(base, "dinner ideas");
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error, "invalid");

    const empty = await post(base, "   ");
    assert.equal(empty.status, 400);
    assert.equal((await empty.json()).error, "empty");
  });
});

test("POST duplicate returns 409 with the existing link (SCN-008)", async () => {
  await withServer(async (base) => {
    const first = await (await post(base, "https://example.com/a")).json();
    const dupRes = await post(base, "https://example.com/a/"); // trailing slash
    assert.equal(dupRes.status, 409);
    const body = await dupRes.json();
    assert.equal(body.error, "duplicate");
    assert.equal(body.link.id, first.link.id);
    // still only one saved
    const all = await (await fetch(base + "/api/links")).json();
    assert.equal(all.links.length, 1);
  });
});

test("PATCH edits tags, note, reading-list membership, manual title (SCN-002/003/004/006)", async () => {
  await withServer(async (base) => {
    const { link } = await (await post(base, "https://private.example.com/x")).json();
    // manual title
    let u = await (await patch(base, link.id, { title: "My Title" })).json();
    assert.equal(u.link.title, "My Title");
    // tags dedup + normalise
    u = await (await patch(base, link.id, { tags: ["#Reading", "reading", "ai"] })).json();
    assert.deepEqual(u.link.tags, ["reading", "ai"]);
    // note
    u = await (await patch(base, link.id, { note: "remember this" })).json();
    assert.equal(u.link.note, "remember this");
    // reading list
    u = await (await patch(base, link.id, { inList: true })).json();
    assert.equal(u.link.inList, true);
  });
});

test("DELETE removes a link permanently (SCN-007)", async () => {
  await withServer(async (base) => {
    const { link } = await (await post(base, "https://example.com/z")).json();
    const del = await fetch(`${base}/api/links/${link.id}`, { method: "DELETE" });
    assert.equal(del.status, 204);
    const all = await (await fetch(base + "/api/links")).json();
    assert.equal(all.links.length, 0);
  });
});

test("data persists across a store reload (durability)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-"));
  const file = join(dir, "links.json");
  try {
    const s1 = new Store(file); await s1.load();
    const server = createHttpServer({ store: s1, fetchInfo: stubInfo });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    await post(base, "https://example.com/persist");
    await new Promise((r) => server.close(r));

    const s2 = new Store(file); await s2.load();
    assert.equal(s2.all().length, 1);
    assert.equal(s2.all()[0].url, "https://example.com/persist");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
