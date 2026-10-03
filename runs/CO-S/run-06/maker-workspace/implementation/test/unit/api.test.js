import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../src/app.js";
import { Store } from "../../src/store.js";

// Spin the app on an ephemeral port with an in-memory store and a fake
// metadata fetcher, then exercise the HTTP API.

let server, base, store;

function fakeFetchMetadata(url) {
  if (url.includes("no-details")) return Promise.resolve({ ok: false });
  return Promise.resolve({ ok: true, title: "Title for " + url, description: "Desc" });
}

async function req(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

before(async () => {
  store = new Store(null);
  const app = createApp({ store, fetchMetadata: fakeFetchMetadata });
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  base = "http://127.0.0.1:" + server.address().port;
});
after(() => server && server.close());

test("POST /api/metadata refuses invalid link (SCN-006)", async () => {
  const { status } = await req("POST", "/api/metadata", { url: "not a url" });
  assert.equal(status, 400);
});

test("POST /api/metadata auto-fills a valid link (SCN-001)", async () => {
  const { status, data } = await req("POST", "/api/metadata", { url: "https://example.com" });
  assert.equal(status, 200);
  assert.equal(data.fetched, true);
  assert.ok(data.title.length > 0);
  assert.equal(data.duplicate, null);
});

test("POST /api/metadata reports fetch failure without blocking (SCN-006)", async () => {
  const { status, data } = await req("POST", "/api/metadata", { url: "https://no-details.example.com/a" });
  assert.equal(status, 200);
  assert.equal(data.fetched, false);
  assert.equal(data.title, "");
});

test("create, list, and duplicate flow (SCN-001/007)", async () => {
  const c = await req("POST", "/api/bookmarks", { url: "https://dup.com", title: "Dup", tags: ["a"] });
  assert.equal(c.status, 201);
  const l = await req("GET", "/api/bookmarks?view=all");
  assert.ok(l.data.items.some((it) => it.url === "https://dup.com/"));
  // metadata reports duplicate
  const m = await req("POST", "/api/metadata", { url: "https://dup.com/" });
  assert.ok(m.data.duplicate);
  assert.equal(m.data.duplicate.location, "all");
  // create again -> 409
  const again = await req("POST", "/api/bookmarks", { url: "https://dup.com" });
  assert.equal(again.status, 409);
  assert.equal(again.data.existing.id, c.data.id);
});

test("edit in place does not create a copy (SCN-007)", async () => {
  const c = await req("POST", "/api/bookmarks", { url: "https://edit.com", title: "Before" });
  const before = (await req("GET", "/api/bookmarks?view=all")).data.items.length;
  const u = await req("PUT", "/api/bookmarks/" + c.data.id, { title: "After", tags: ["t"] });
  assert.equal(u.data.title, "After");
  const after = (await req("GET", "/api/bookmarks?view=all")).data.items.length;
  assert.equal(before, after);
});

test("read-later toggle and view (SCN-003)", async () => {
  const c = await req("POST", "/api/bookmarks", { url: "https://later.com", title: "L" });
  await req("POST", `/api/bookmarks/${c.data.id}/later`, { later: true });
  let later = await req("GET", "/api/bookmarks?view=later");
  assert.ok(later.data.items.some((it) => it.id === c.data.id));
  await req("POST", `/api/bookmarks/${c.data.id}/later`, { later: false });
  later = await req("GET", "/api/bookmarks?view=later");
  assert.ok(!later.data.items.some((it) => it.id === c.data.id));
});

test("archive/restore and search within archive (SCN-004)", async () => {
  const c = await req("POST", "/api/bookmarks", { url: "https://arch.com", title: "Archived One" });
  await req("POST", `/api/bookmarks/${c.data.id}/archive`, { archived: true });
  const all = await req("GET", "/api/bookmarks?view=all");
  assert.ok(!all.data.items.some((it) => it.id === c.data.id));
  const arch = await req("GET", "/api/bookmarks?view=archive&q=archived");
  assert.ok(arch.data.items.some((it) => it.id === c.data.id));
  await req("POST", `/api/bookmarks/${c.data.id}/archive`, { archived: false });
  const all2 = await req("GET", "/api/bookmarks?view=all");
  assert.ok(all2.data.items.some((it) => it.id === c.data.id));
});

test("search no-results returns empty list (SCN-002/005)", async () => {
  const r = await req("GET", "/api/bookmarks?view=all&q=zzznotfound");
  assert.equal(r.data.items.length, 0);
});
