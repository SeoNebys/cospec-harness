import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../src/app.js";

// In-memory store matching the interface app.js relies on.
class MemoryStore {
  constructor() { this.bookmarks = []; }
  all() { return this.bookmarks; }
  findById(id) { return this.bookmarks.find((b) => b.id === id) || null; }
  findByUrl(url) { return this.bookmarks.find((b) => b.url === (url || "").trim()) || null; }
  async add(b) { this.bookmarks.unshift(b); return b; }
  async update(id, patch) { const b = this.findById(id); if (!b) return null; Object.assign(b, patch); return b; }
  async remove(id) { const i = this.bookmarks.findIndex((b) => b.id === id); if (i < 0) return false; this.bookmarks.splice(i, 1); return true; }
}

const HTML = {
  "https://reactjs.org/docs/hooks-intro.html":
    `<title>Introducing Hooks - React</title><meta name="description" content="Use state without a class.">`,
};
async function fakeFetch(url) {
  if (/broken|unreachable/.test(url)) throw new Error("nope");
  const body = HTML[url] || `<title>${url}</title>`;
  return { ok: true, headers: { get: () => "text/html" }, text: async () => body };
}

let server, base, store;

before(async () => {
  store = new MemoryStore();
  const app = createApp({ store, fetchImpl: fakeFetch });
  await new Promise((res) => { server = app.listen(0, "127.0.0.1", res); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server && server.close());

async function req(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  if (res.status !== 204) { try { json = await res.json(); } catch {} }
  return { status: res.status, json };
}

test("POST saves a link with auto-filled details, status to-read, newest first (SCN-001/004)", async () => {
  const r = await req("POST", "/api/bookmarks", { url: "https://reactjs.org/docs/hooks-intro.html" });
  assert.equal(r.status, 201);
  assert.equal(r.json.title, "Introducing Hooks - React");
  assert.equal(r.json.description, "Use state without a class.");
  assert.equal(r.json.site, "reactjs.org");
  assert.equal(r.json.status, "to-read");
  assert.equal(r.json.archived, false);
  assert.equal(r.json.unreadable, false);
  const list = await req("GET", "/api/bookmarks");
  assert.equal(list.json[0].id, r.json.id); // newest first
});

test("POST rejects a malformed address (SCN-007)", async () => {
  const r = await req("POST", "/api/bookmarks", { url: "not a url" });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "invalid_url");
});

test("POST keeps an unreadable page with a fallback + unreadable flag (SCN-007)", async () => {
  const r = await req("POST", "/api/bookmarks", { url: "https://unreachable.example/broken" });
  assert.equal(r.status, 201);
  assert.equal(r.json.unreadable, true);
  assert.ok(r.json.title.length > 0);
});

test("POST prevents duplicates and points to the existing one (SCN-007)", async () => {
  await req("POST", "/api/bookmarks", { url: "https://dup.example/a" });
  const r = await req("POST", "/api/bookmarks", { url: "https://dup.example/a" });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, "duplicate");
  assert.ok(r.json.bookmark && r.json.bookmark.url === "https://dup.example/a");
});

test("PATCH edits fields, tags, and note (SCN-002/008)", async () => {
  const c = await req("POST", "/api/bookmarks", { url: "https://edit.example/a" });
  const id = c.json.id;
  const r = await req("PATCH", `/api/bookmarks/${id}`, {
    title: "My Title", description: "d", note: "n", tags: ["x", "x", "y"],
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.title, "My Title");
  assert.equal(r.json.note, "n");
  assert.deepEqual(r.json.tags, ["x", "y"]); // de-duplicated
});

test("PATCH edits the web address with validation (SCN-008)", async () => {
  const c = await req("POST", "/api/bookmarks", { url: "https://old.example/a" });
  const id = c.json.id;
  const bad = await req("PATCH", `/api/bookmarks/${id}`, { url: "nope" });
  assert.equal(bad.status, 400);
  const ok = await req("PATCH", `/api/bookmarks/${id}`, { url: "https://new.example/b" });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.url, "https://new.example/b");
  assert.equal(ok.json.site, "new.example");
});

test("PATCH toggles status and archived (SCN-004/005)", async () => {
  const c = await req("POST", "/api/bookmarks", { url: "https://st.example/a" });
  const id = c.json.id;
  let r = await req("PATCH", `/api/bookmarks/${id}`, { status: "finished" });
  assert.equal(r.json.status, "finished");
  r = await req("PATCH", `/api/bookmarks/${id}`, { archived: true });
  assert.equal(r.json.archived, true);
});

test("DELETE removes permanently (SCN-009)", async () => {
  const c = await req("POST", "/api/bookmarks", { url: "https://del.example/a" });
  const id = c.json.id;
  const d = await req("DELETE", `/api/bookmarks/${id}`);
  assert.equal(d.status, 204);
  const g = await req("GET", "/api/bookmarks");
  assert.ok(!g.json.some((b) => b.id === id));
  const again = await req("DELETE", `/api/bookmarks/${id}`);
  assert.equal(again.status, 404);
});
