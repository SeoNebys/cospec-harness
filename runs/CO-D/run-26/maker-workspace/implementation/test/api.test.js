// Integration tests against the real HTTP server + SQLite (temp DB).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 4072;
const BASE = `http://127.0.0.1:${PORT}`;
let tmp, httpServer;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bm-test-"));
  process.env.BM_DATA_DIR = tmp;
  process.env.PORT = String(PORT);
  const mod = await import("../server.js");
  httpServer = mod.httpServer;
  await new Promise((r) => (httpServer.listening ? r() : httpServer.once("listening", r)));
});
after(async () => {
  if (httpServer.closeAllConnections) httpServer.closeAllConnections();
  await new Promise((r) => httpServer.close(r));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

const J = (method, url, body) => fetch(BASE + url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

test("create, dedupe, edit-collision, delete (SCN-001/003/011)", async () => {
  const a = await J("POST", "/api/bookmarks", { url: "https://example.com/a", title: "A", tags: ["x"] });
  assert.equal(a.status, 201);
  const b = await J("POST", "/api/bookmarks", { url: "https://example.com/b", title: "B" });
  assert.equal(b.status, 201);
  // duplicate (www + trailing slash + case) -> 409
  const dup = await J("POST", "/api/bookmarks", { url: "https://WWW.example.com/a/", title: "dup" });
  assert.equal(dup.status, 409);
  // edit B's address to collide with A -> 409
  const clash = await J("PUT", "/api/bookmarks/" + b.data.id, { url: "https://example.com/a" });
  assert.equal(clash.status, 409);
  // edit B normally
  const edited = await J("PUT", "/api/bookmarks/" + b.data.id, { title: "B2", tags: ["y", "y"] });
  assert.equal(edited.data.title, "B2");
  assert.deepEqual(edited.data.tags, ["y"]); // de-duplicated
  // delete A
  assert.equal((await J("DELETE", "/api/bookmarks/" + a.data.id)).status, 200);
  const st = await J("GET", "/api/state");
  assert.equal(st.data.bookmarks.length, 1);
});

test("read-later, archive, restore (SCN-006/012)", async () => {
  const c = (await J("POST", "/api/bookmarks", { url: "https://example.com/rl", title: "RL" })).data;
  await J("PUT", "/api/bookmarks/" + c.id, { readLater: true });
  let got = (await J("GET", "/api/state")).data.bookmarks.find((x) => x.id === c.id);
  assert.equal(got.readLater, true);
  await J("PUT", "/api/bookmarks/" + c.id, { archived: true });
  got = (await J("GET", "/api/state")).data.bookmarks.find((x) => x.id === c.id);
  assert.equal(got.archived, true);
  await J("PUT", "/api/bookmarks/" + c.id, { archived: false });
  got = (await J("GET", "/api/state")).data.bookmarks.find((x) => x.id === c.id);
  assert.equal(got.archived, false);
});

test("bulk add/remove tags and delete (SCN-013)", async () => {
  const ids = [];
  for (const n of ["p", "q", "r"]) ids.push((await J("POST", "/api/bookmarks", { url: "https://bulk.com/" + n, title: n })).data.id);
  await J("POST", "/api/bookmarks/bulk", { ids, action: "addTags", payload: { tags: ["group"] } });
  let bms = (await J("GET", "/api/state")).data.bookmarks;
  assert.equal(bms.filter((b) => b.tags.includes("group")).length, 3);
  await J("POST", "/api/bookmarks/bulk", { ids, action: "removeTags", payload: { tags: ["group"] } });
  bms = (await J("GET", "/api/state")).data.bookmarks;
  assert.equal(bms.filter((b) => b.tags.includes("group")).length, 0);
  await J("POST", "/api/bookmarks/bulk", { ids, action: "delete" });
  bms = (await J("GET", "/api/state")).data.bookmarks;
  assert.equal(bms.filter((b) => ids.includes(b.id)).length, 0);
});

test("saved filters and prefs persist (SCN-016/007/018)", async () => {
  const f = await J("POST", "/api/filters", { name: "Refs", query: "", include: ["reference"], exclude: ["api"] });
  assert.equal(f.status, 201);
  assert.equal(f.data.filters[0].name, "Refs");
  await J("PUT", "/api/prefs", { key: "sort", value: "title-az" });
  const st = await J("GET", "/api/state");
  assert.equal(st.data.prefs.sort, "title-az");
  await J("DELETE", "/api/filters/" + f.data.filters[0].id);
  assert.equal((await J("GET", "/api/state")).data.filters.length, 0);
});

test("export includes archived folder; import is additive and skips dupes (SCN-017)", async () => {
  // archive one existing
  const st0 = (await J("GET", "/api/state")).data.bookmarks;
  await J("PUT", "/api/bookmarks/" + st0[0].id, { archived: true });
  const exp = await fetch(BASE + "/api/export").then((r) => r.text());
  assert.ok(exp.includes("<H3>Archived</H3>"));
  const before = (await J("GET", "/api/state")).data.bookmarks.length;
  const impFile = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://new-import.com/z" ADD_DATE="1600000000" TAGS="imp">Fresh</A><DT><A HREF="https://example.com/rl">dupe of existing</A></DL>';
  const imp = await fetch(BASE + "/api/import", { method: "POST", headers: { "Content-Type": "text/html" }, body: impFile }).then((r) => r.json());
  assert.equal(imp.added, 1);
  assert.ok(imp.skipped >= 1);
  const after = (await J("GET", "/api/state")).data.bookmarks;
  assert.equal(after.length, before + 1);
  const fresh = after.find((b) => b.url === "https://new-import.com/z");
  assert.deepEqual(fresh.tags, ["imp"]);
  assert.equal(fresh.addedAt, 1600000000 * 1000);
});
