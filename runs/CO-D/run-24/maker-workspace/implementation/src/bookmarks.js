'use strict';
// Bookmark domain logic over the DB, plus orchestration of async preserved-copy
// capture and Internet Archive saves. Implements SCN-001/002/003/005/006/010/012/014/015.
const { db, tx, nextSeq } = require('./db');
const { normalizeKey, looksLikeUrl, withScheme, isPdfUrl } = require('./urls');
const { fetchMetadata } = require('./metadata');
const { captureSnapshot } = require('./snapshot');
const { saveToArchiveOrg } = require('./archiveorg');

function rowToApi(r) {
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    description: r.description,
    favicon: r.favicon,
    previewImage: r.preview_image,
    note: r.note,
    tags: JSON.parse(r.tags || '[]'),
    readLater: !!r.read_later,
    archived: !!r.archived,
    createdAt: r.created_at,
    seq: r.seq,
    fetchFailed: !!r.fetch_failed,
    snapshotStatus: r.snapshot_status,
    snapshotAt: r.snapshot_at,
    snapshotIsPdf: !!r.snapshot_is_pdf,
    hasSnapshot: r.snapshot_status === 'saved',
    archiveorgStatus: r.archiveorg_status,
    archiveorgUrl: r.archiveorg_url,
  };
}

function getRow(userId, id) {
  return db.prepare('SELECT * FROM bookmarks WHERE user_id=? AND id=?').get(userId, id);
}
function getByKey(userId, key) {
  return db.prepare('SELECT * FROM bookmarks WHERE user_id=? AND url_key=?').get(userId, key);
}
function list(userId) {
  return db.prepare('SELECT * FROM bookmarks WHERE user_id=? ORDER BY created_at DESC, seq DESC')
    .all(userId).map(rowToApi);
}
function get(userId, id) {
  const r = getRow(userId, id);
  return r ? rowToApi(r) : null;
}

// --- async preserved-copy capture ---
async function runSnapshot(userId, id) {
  const r = getRow(userId, id);
  if (!r) return;
  db.prepare('UPDATE bookmarks SET snapshot_status=? WHERE id=?').run('pending', id);
  try {
    const snap = await captureSnapshot(r);
    db.prepare('UPDATE bookmarks SET snapshot_status=?, snapshot_at=?, snapshot_is_pdf=?, snapshot_file=? WHERE id=?')
      .run('saved', snap.savedAt, snap.isPdf ? 1 : 0, snap.file, id);
  } catch (e) {
    db.prepare('UPDATE bookmarks SET snapshot_status=? WHERE id=?').run('failed', id);
  }
}
function scheduleSnapshot(userId, id) {
  // Fire-and-forget; the client polls for status.
  setImmediate(() => { runSnapshot(userId, id).catch(() => {}); });
}

async function runArchiveOrg(userId, id) {
  const r = getRow(userId, id);
  if (!r) return;
  db.prepare('UPDATE bookmarks SET archiveorg_status=? WHERE id=?').run('pending', id);
  try {
    const archived = await saveToArchiveOrg(r.url);
    db.prepare('UPDATE bookmarks SET archiveorg_status=?, archiveorg_url=? WHERE id=?').run('saved', archived, id);
  } catch (e) {
    db.prepare('UPDATE bookmarks SET archiveorg_status=? WHERE id=?').run('failed', id);
  }
}

// --- create ---
async function create(userId, rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return { error: 'empty', message: 'Please paste a web address to save.' };
  if (!looksLikeUrl(url)) return { error: 'invalid', message: "That doesn't look like a web address." };
  const key = normalizeKey(url);
  const existing = getByKey(userId, key);
  if (existing) return { duplicate: true, bookmark: rowToApi(existing) };

  const meta = await fetchMetadata(url);
  const now = Date.now();
  const info = db.prepare(`INSERT INTO bookmarks
      (user_id,url,url_key,title,description,favicon,preview_image,note,tags,read_later,archived,created_at,seq,fetch_failed,snapshot_status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    userId, withScheme(url), key,
    meta.ok ? (meta.title || '') : (meta.host || url),
    meta.ok ? (meta.description || '') : '',
    meta.favicon || null,
    meta.ok ? (meta.image || null) : null,
    '', '[]', 0, 0, now, nextSeq(userId),
    meta.ok ? 0 : 1,
    'pending',
  );
  const id = info.lastInsertRowid;
  scheduleSnapshot(userId, id);
  return { bookmark: get(userId, id) };
}

// --- update (with address-change dedup guard, SCN-002) ---
function update(userId, id, fields) {
  const r = getRow(userId, id);
  if (!r) return { error: 'notfound' };
  const set = [];
  const vals = [];
  if (typeof fields.url === 'string' && fields.url.trim()) {
    const newUrl = fields.url.trim();
    if (!looksLikeUrl(newUrl)) return { error: 'invalid', message: "That doesn't look like a web address." };
    const newKey = normalizeKey(newUrl);
    const clash = getByKey(userId, newKey);
    if (clash && clash.id !== id) return { error: 'conflict', message: 'Another bookmark already uses that web address.' };
    set.push('url=?', 'url_key=?'); vals.push(withScheme(newUrl), newKey);
  }
  if (typeof fields.title === 'string') { set.push('title=?'); vals.push(fields.title.trim()); }
  if (typeof fields.description === 'string') { set.push('description=?'); vals.push(fields.description); }
  if (typeof fields.note === 'string') { set.push('note=?'); vals.push(fields.note); }
  if (Array.isArray(fields.tags)) { set.push('tags=?'); vals.push(JSON.stringify(cleanTags(fields.tags))); }
  if (typeof fields.readLater === 'boolean') { set.push('read_later=?'); vals.push(fields.readLater ? 1 : 0); }
  if (typeof fields.archived === 'boolean') { set.push('archived=?'); vals.push(fields.archived ? 1 : 0); }
  if (!set.length) return { bookmark: rowToApi(r) };
  vals.push(userId, id);
  db.prepare(`UPDATE bookmarks SET ${set.join(',')} WHERE user_id=? AND id=?`).run(...vals);
  return { bookmark: get(userId, id) };
}

function cleanTags(tags) {
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    const s = String(t || '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}

function remove(userId, id) {
  const r = getRow(userId, id);
  if (!r) return { error: 'notfound' };
  db.prepare('DELETE FROM bookmarks WHERE user_id=? AND id=?').run(userId, id);
  return { ok: true };
}

// --- bulk actions (SCN-012) ---
function bulk(userId, ids, action, value) {
  if (!Array.isArray(ids) || !ids.length) return { error: 'empty' };
  const rows = ids.map((id) => getRow(userId, id)).filter(Boolean);
  tx(() => {
    for (const r of rows) {
      if (action === 'readLater') db.prepare('UPDATE bookmarks SET read_later=1 WHERE id=?').run(r.id);
      else if (action === 'read') db.prepare('UPDATE bookmarks SET read_later=0 WHERE id=?').run(r.id);
      else if (action === 'archive') db.prepare('UPDATE bookmarks SET archived=1 WHERE id=?').run(r.id);
      else if (action === 'restore') db.prepare('UPDATE bookmarks SET archived=0 WHERE id=?').run(r.id);
      else if (action === 'delete') db.prepare('DELETE FROM bookmarks WHERE id=?').run(r.id);
      else if (action === 'addTag') {
        const tags = cleanTags([...JSON.parse(r.tags || '[]'), value]);
        db.prepare('UPDATE bookmarks SET tags=? WHERE id=?').run(JSON.stringify(tags), r.id);
      } else if (action === 'removeTag') {
        const tags = JSON.parse(r.tags || '[]').filter((t) => String(t).toLowerCase() !== String(value).toLowerCase());
        db.prepare('UPDATE bookmarks SET tags=? WHERE id=?').run(JSON.stringify(tags), r.id);
      }
    }
  });
  return { ok: true, count: rows.length };
}

// --- import (SCN-015) ---
function importParsed(userId, parsed) {
  let added = 0, skipped = 0;
  const created = [];
  tx(() => {
    for (const p of parsed) {
      const key = normalizeKey(p.url);
      if (getByKey(userId, key)) { skipped++; continue; }
      const info = db.prepare(`INSERT INTO bookmarks
        (user_id,url,url_key,title,description,favicon,preview_image,note,tags,read_later,archived,created_at,seq,fetch_failed,snapshot_status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        userId, withScheme(p.url), key, p.title || p.url, '', null, null, '',
        JSON.stringify(cleanTags(p.tags || [])), 0, 0,
        p.createdAt || Date.now(), nextSeq(userId), 0, 'pending');
      created.push(info.lastInsertRowid);
      added++;
    }
  });
  // Preserve copies for imported bookmarks too, throttled.
  scheduleSnapshotsThrottled(userId, created);
  return { added, skipped };
}

function scheduleSnapshotsThrottled(userId, ids, concurrency = 3) {
  let i = 0;
  let active = 0;
  function pump() {
    while (active < concurrency && i < ids.length) {
      const id = ids[i++];
      active++;
      runSnapshot(userId, id).catch(() => {}).finally(() => { active--; pump(); });
    }
  }
  setImmediate(pump);
}

function exportList(userId) {
  return db.prepare('SELECT url,title,tags,created_at FROM bookmarks WHERE user_id=? ORDER BY created_at ASC, seq ASC')
    .all(userId)
    .map((r) => ({ url: r.url, title: r.title, tags: JSON.parse(r.tags || '[]'), createdAt: r.created_at }));
}

module.exports = {
  rowToApi, list, get, getRow, create, update, remove, bulk,
  importParsed, exportList, runSnapshot, scheduleSnapshot, runArchiveOrg,
};
