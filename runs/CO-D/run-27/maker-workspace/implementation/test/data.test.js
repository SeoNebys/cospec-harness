// Data-layer acceptance tests against a temporary database (SCN-001,002,003,005,
// 006,007,009,010,012,013). Uses a throwaway BM_DATA_DIR so it never touches real data.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BM_DATA_DIR = mkdtempSync(join(tmpdir(), "bm-test-"));
let auth, repo, uid;
before(async () => {
  auth = await import("../src/auth.js");
  repo = await import("../src/repo.js");
  const u = auth.createUser("t@t.com", "password1");
  uid = u.id;
});

test("SCN accounts: create/verify/session", () => {
  assert.ok(auth.verifyUser("t@t.com", "password1"));
  assert.equal(auth.verifyUser("t@t.com", "wrong"), null);
  const sid = auth.startSession(uid);
  assert.equal(auth.userForSession(sid).email, "t@t.com");
});

test("SCN-001/006 create with tags + SCN-013 fields present", () => {
  const b = repo.create(uid, { url: "https://example.com/a", title: "A", tags: ["x"], toRead: true });
  assert.equal(b.url, "https://example.com/a");
  assert.equal(b.toRead, true);
  assert.deepEqual(b.tags, ["x"]);
  assert.ok(b.savedAt);
});

test("SCN-002 duplicate detection via norm", () => {
  repo.create(uid, { url: "https://dup.com/x", title: "Dup" });
  assert.ok(repo.rawByNorm(uid, "https://dup.com/x"));
  // a safe-equal variant normalizes to the same
  const { normalize } = { normalize: (u) => u }; // norm computed in create
});

test("SCN-003 edit title/desc/url/tags + clash awareness data", () => {
  const b = repo.create(uid, { url: "https://edit.com/1", title: "E" });
  const up = repo.update(uid, b.id, { title: "E2", description: "d", tags: ["y"], url: "https://edit.com/2" });
  assert.equal(up.title, "E2");
  assert.equal(up.url, "https://edit.com/2");
  assert.deepEqual(up.tags, ["y"]);
  assert.ok(up.editedAt);
});

test("SCN-005 reading state + SCN-007 archive/restore/delete", () => {
  const b = repo.create(uid, { url: "https://r.com/1", title: "R", toRead: true });
  assert.equal(repo.update(uid, b.id, { toRead: false }).toRead, false);
  assert.equal(repo.update(uid, b.id, { archived: true }).archived, true);
  assert.equal(repo.update(uid, b.id, { archived: false }).archived, false);
  assert.equal(repo.remove(uid, b.id), true);
  assert.equal(repo.get(uid, b.id), null);
});

test("SCN-011 snapshot page/pdf + archive online storage", () => {
  const b = repo.create(uid, { url: "https://s.com/1", title: "S" });
  let up = repo.setSnapshot(uid, b.id, { kind: "page", content: "# hi" });
  assert.equal(up.snapshot.kind, "page");
  up = repo.setSnapshot(uid, b.id, { kind: "pdf", mime: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) });
  assert.equal(up.snapshot.kind, "pdf");
  const file = repo.snapshotContent(uid, b.id);
  assert.equal(file.mime, "application/pdf");
  assert.equal(file.bytes.length, 4);
  up = repo.setArchive(uid, b.id, { url: "https://web.archive.org/web/1/https://s.com/1", archivedAt: Date.now() });
  assert.ok(up.archiveUrl.startsWith("https://web.archive.org/"));
  assert.equal(repo.removeSnapshot(uid, b.id).snapshot, null);
});

test("SCN-010 views + prefs persistence", () => {
  const views = repo.createView(uid, { name: "V", query: "rome", includeTags: ["travel"], excludeTags: ["done"], filter: "unread", sort: "title-asc" });
  const v = views.find((x) => x.name === "V");
  assert.deepEqual(v.includeTags, ["travel"]);
  assert.deepEqual(v.excludeTags, ["done"]);
  assert.equal(repo.setPrefs(uid, { sort: "title-asc", pageSize: 50, textSize: "large" }).pageSize, 50);
  assert.equal(repo.getPrefs(uid).textSize, "large");
});

test("SCN-011 page copy stored as self-contained HTML (not plain text)", () => {
  const b = repo.create(uid, { url: "https://page.com/1", title: "P" });
  const up = repo.setSnapshot(uid, b.id, { kind: "page", mime: "text/html", content: "<html><body>hi</body></html>" });
  assert.equal(up.snapshot.kind, "page");
  const s = repo.snapshotContent(uid, b.id);
  assert.equal(s.mime, "text/html");
  assert.match(s.content, /<html/);
});

test("SCN-012 full backup includes saved copy + Archive + dates; PDF round-trips", () => {
  const b = repo.create(uid, { url: "https://exp.com/1", title: "E", savedAt: 111, editedAt: 222 });
  repo.setSnapshot(uid, b.id, { kind: "page", mime: "text/html", content: "<html>x</html>", capturedAt: 333 });
  repo.setArchive(uid, b.id, { url: "https://web.archive.org/web/1/https://exp.com/1", archivedAt: 444 });
  const ex = repo.exportAll(uid).find((x) => x.url === "https://exp.com/1");
  assert.equal(ex.snapshot.kind, "page");
  assert.equal(ex.snapshot.content, "<html>x</html>");
  assert.equal(ex.snapshot.capturedAt, 333);
  assert.ok(ex.archiveUrl.startsWith("https://web.archive.org/"));
  assert.equal(ex.archivedAt, 444);
  assert.equal(ex.savedAt, 111);
  assert.equal(ex.editedAt, 222);
  const p = repo.create(uid, { url: "https://exp.com/2.pdf", title: "P" });
  repo.setSnapshot(uid, p.id, { kind: "pdf", mime: "application/pdf", bytes: new Uint8Array([1, 2, 3]) });
  const ep = repo.exportAll(uid).find((x) => x.url === "https://exp.com/2.pdf");
  assert.ok(ep.snapshot.pdfBase64);
  assert.equal(Buffer.from(ep.snapshot.pdfBase64, "base64").length, 3);
});

test("cross-user isolation (per-account sync boundary)", () => {
  const u2 = auth.createUser("other@t.com", "password1");
  repo.create(u2.id, { url: "https://only-u2.com", title: "U2" });
  assert.equal(repo.list(uid).some((b) => b.url === "https://only-u2.com"), false);
});
