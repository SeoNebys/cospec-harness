// Data access for bookmarks, preferences and saved views.
import { randomBytes } from "node:crypto";
import db from "./db.js";
import { normalize } from "./public/shared/normalize.js";

const id = (p) => p + randomBytes(9).toString("hex");

const qList = db.prepare("SELECT * FROM bookmarks WHERE user_id = ? ORDER BY saved_at DESC");
const qGet = db.prepare("SELECT * FROM bookmarks WHERE user_id = ? AND id = ?");
const qByNorm = db.prepare("SELECT * FROM bookmarks WHERE user_id = ? AND norm = ?");
const qIns = db.prepare(`INSERT INTO bookmarks
  (id,user_id,url,norm,title,description,icon_letter,icon_color,preview_label,preview_color,tags_json,note,to_read,archived,saved_at,edited_at)
  VALUES (@id,@user_id,@url,@norm,@title,@description,@icon_letter,@icon_color,@preview_label,@preview_color,@tags_json,@note,@to_read,@archived,@saved_at,@edited_at)`);
const qDel = db.prepare("DELETE FROM bookmarks WHERE user_id = ? AND id = ?");

function rowToObj(r, opts = {}) {
  const o = {
    id: r.id, url: r.url, norm: r.norm, title: r.title, description: r.description,
    icon: { letter: r.icon_letter, color: r.icon_color },
    preview: { label: r.preview_label, color: r.preview_color },
    tags: JSON.parse(r.tags_json || "[]"),
    note: r.note, toRead: !!r.to_read, archived: !!r.archived,
    snapshot: r.snap_kind ? { kind: r.snap_kind, capturedAt: r.snap_captured_at } : null,
    archiveUrl: r.archive_url || null, archivedAt: r.archived_at || null,
    savedAt: r.saved_at, editedAt: r.edited_at,
  };
  if (opts.withContent && r.snap_kind === "page") o.snapshot.content = r.snap_content;
  return o;
}

export const list = (uid) => qList.all(uid).map((r) => rowToObj(r));

// Full backup: every field plus the saved-copy content (page HTML or PDF bytes as
// base64), Internet-Archive reference, and dates — so a JSON restore is complete.
export function exportAll(uid) {
  return qList.all(uid).map((r) => {
    const o = rowToObj(r);
    if (r.snap_kind === "page") o.snapshot = { kind: "page", capturedAt: r.snap_captured_at, mime: r.snap_mime || "text/html", content: r.snap_content };
    else if (r.snap_kind === "pdf") o.snapshot = { kind: "pdf", capturedAt: r.snap_captured_at, mime: r.snap_mime || "application/pdf", pdfBase64: r.snap_pdf ? Buffer.from(r.snap_pdf).toString("base64") : null };
    return o;
  });
}
export const get = (uid, bid, opts) => { const r = qGet.get(uid, bid); return r ? rowToObj(r, opts) : null; };
export const rawByNorm = (uid, norm) => qByNorm.get(uid, norm);

export function create(uid, b) {
  const now = Date.now();
  const row = {
    id: id("b"), user_id: uid, url: b.url, norm: normalize(b.url),
    title: b.title || b.url, description: b.description || "",
    icon_letter: b.icon?.letter || "?", icon_color: b.icon?.color || "#2f6feb",
    preview_label: b.preview?.label || "Link", preview_color: b.preview?.color || "#2f6feb",
    tags_json: JSON.stringify(b.tags || []), note: b.note || "",
    to_read: b.toRead ? 1 : 0, archived: b.archived ? 1 : 0,
    saved_at: b.savedAt || now, edited_at: b.editedAt || null,
  };
  qIns.run(row);
  return get(uid, row.id);
}

export function update(uid, bid, fields) {
  const r = qGet.get(uid, bid);
  if (!r) return null;
  const set = [], vals = [];
  const map = {
    title: "title", description: "description", url: "url", note: "note",
  };
  for (const k of Object.keys(map)) if (k in fields) { set.push(map[k] + "=?"); vals.push(fields[k]); }
  if ("tags" in fields) { set.push("tags_json=?"); vals.push(JSON.stringify(fields.tags)); }
  if ("toRead" in fields) { set.push("to_read=?"); vals.push(fields.toRead ? 1 : 0); }
  if ("archived" in fields) { set.push("archived=?"); vals.push(fields.archived ? 1 : 0); }
  if ("url" in fields) { set.push("norm=?"); vals.push(normalize(fields.url)); }
  if (fields.touch !== false) { set.push("edited_at=?"); vals.push(Date.now()); }
  if (!set.length) return get(uid, bid);
  db.prepare(`UPDATE bookmarks SET ${set.join(",")} WHERE user_id=? AND id=?`).run(...vals, uid, bid);
  return get(uid, bid);
}

export function remove(uid, bid) { return qDel.run(uid, bid).changes > 0; }

export function setSnapshot(uid, bid, snap) {
  const r = qGet.get(uid, bid); if (!r) return null;
  if (snap.kind === "pdf") {
    db.prepare("UPDATE bookmarks SET snap_kind='pdf', snap_captured_at=?, snap_content=NULL, snap_mime=?, snap_pdf=? WHERE user_id=? AND id=?")
      .run(snap.capturedAt || Date.now(), snap.mime, snap.bytes, uid, bid);
  } else {
    db.prepare("UPDATE bookmarks SET snap_kind='page', snap_captured_at=?, snap_content=?, snap_mime=?, snap_pdf=NULL WHERE user_id=? AND id=?")
      .run(snap.capturedAt || Date.now(), snap.content, snap.mime || "text/html", uid, bid);
  }
  return get(uid, bid);
}
export function removeSnapshot(uid, bid) {
  db.prepare("UPDATE bookmarks SET snap_kind=NULL, snap_captured_at=NULL, snap_content=NULL, snap_mime=NULL, snap_pdf=NULL WHERE user_id=? AND id=?").run(uid, bid);
  return get(uid, bid);
}
export function snapshotContent(uid, bid) {
  const r = qGet.get(uid, bid); if (!r || !r.snap_kind) return null;
  return { kind: r.snap_kind, capturedAt: r.snap_captured_at, content: r.snap_content, mime: r.snap_mime, bytes: r.snap_pdf };
}

export function setArchive(uid, bid, a) {
  db.prepare("UPDATE bookmarks SET archive_url=?, archived_at=? WHERE user_id=? AND id=?").run(a.url, a.archivedAt, uid, bid);
  return get(uid, bid);
}
export function removeArchive(uid, bid) {
  db.prepare("UPDATE bookmarks SET archive_url=NULL, archived_at=NULL WHERE user_id=? AND id=?").run(uid, bid);
  return get(uid, bid);
}

// ---- prefs ----
export function getPrefs(uid) {
  const r = db.prepare("SELECT * FROM prefs WHERE user_id=?").get(uid) || { sort: "added-desc", page_size: 20, text_size: "medium" };
  return { sort: r.sort, pageSize: r.page_size, textSize: r.text_size };
}
export function setPrefs(uid, p) {
  db.prepare("INSERT INTO prefs (user_id,sort,page_size,text_size) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET sort=excluded.sort, page_size=excluded.page_size, text_size=excluded.text_size")
    .run(uid, p.sort || "added-desc", p.pageSize || 20, p.textSize || "medium");
  return getPrefs(uid);
}

// ---- views ----
export function listViews(uid) {
  return db.prepare("SELECT * FROM views WHERE user_id=? ORDER BY created_at ASC").all(uid).map((v) => ({
    id: v.id, name: v.name, query: v.query, includeTags: JSON.parse(v.include_json || "[]"),
    excludeTags: JSON.parse(v.exclude_json || "[]"), filter: v.filter, sort: v.sort,
  }));
}
export function createView(uid, v) {
  const vid = id("v");
  db.prepare("INSERT INTO views (id,user_id,name,query,include_json,exclude_json,filter,sort,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(vid, uid, v.name, v.query || "", JSON.stringify(v.includeTags || []), JSON.stringify(v.excludeTags || []), v.filter || "all", v.sort || "added-desc", Date.now());
  return listViews(uid);
}
export function deleteView(uid, vid) {
  db.prepare("DELETE FROM views WHERE user_id=? AND id=?").run(uid, vid);
  return listViews(uid);
}
