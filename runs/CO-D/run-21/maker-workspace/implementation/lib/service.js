'use strict';
// Business logic layer (testable without HTTP). Implements the approved
// behaviours over the Store.
const { normalizeUrl, isPdf, canonTag } = require('./util');
const { capture } = require('./preserve');
const { parseNetscape, buildNetscape } = require('./netscape');

function dedupeTags(tags, allBookmarks) {
  const existing = [];
  (allBookmarks || []).forEach(b => (b.tags || []).forEach(t => existing.push(t)));
  const seen = new Set();
  const out = [];
  (tags || []).map(t => String(t).trim()).filter(Boolean).forEach(t => {
    const c = canonTag(t, existing.concat(out));
    const k = c.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(c); }
  });
  return out;
}

class Service {
  constructor(store, opts = {}) {
    this.store = store;
    this.capOpts = opts.capOpts || {};
  }

  state() { return this.store.state(); }

  findByAddress(url) {
    const n = normalizeUrl(url);
    return this.store.db.bookmarks.find(b => normalizeUrl(b.url) === n);
  }

  // Lightweight metadata for the save form (SCN-001 auto-fill preview).
  async previewMeta(url) {
    const cap = await capture(url, Object.assign({}, this.capOpts, { inlineImages: false }));
    return { readable: cap.readable !== false, title: cap.title || '', description: cap.description || '', kind: cap.kind || (isPdf(url) ? 'pdf' : 'page') };
  }

  // Create a bookmark, capturing a preserved copy (SCN-001, SCN-014, SCN-005).
  async createBookmark(input) {
    const url = String(input.url || '').trim();
    if (!url) throw new Error('url required');
    const existing = this.findByAddress(url);
    if (existing) return { duplicate: true, existing };

    const cap = await capture(url, this.capOpts);
    const now = Date.now();
    const tags = dedupeTags(input.tags, this.store.db.bookmarks);
    const kind = cap.kind || (isPdf(url) ? 'pdf' : 'page');
    const b = {
      url,
      title: (input.title && String(input.title).trim()) || (cap.readable ? cap.title : '') || url,
      description: input.description != null ? String(input.description) : (cap.readable ? cap.description : ''),
      tags,
      note: input.note || '',
      read: !!input.read,
      archived: false,
      createdAt: now,
      contentCollected: cap.readable !== false,
      preserved: { status: cap.readable ? 'saved' : 'none', savedAt: cap.readable ? now : null, kind, archiveUrl: null },
    };
    this.store.addBookmark(b);
    if (cap.readable) {
      if (kind === 'pdf') this.store.writeSnapshot(b.id, 'pdf', cap.pdfBuffer);
      else this.store.writeSnapshot(b.id, 'page', cap.snapshotHtml);
    }
    let archiveError = null;
    if (input.archiveOrg && cap.readable) {
      try { await this.sendToArchive(b.id); } catch (e) { archiveError = e.message; }
    }
    return { bookmark: b, readable: cap.readable, archiveError };
  }

  // Edit fields / toggle read / archive (SCN-006, SCN-012, SCN-013).
  updateBookmark(id, patch) {
    const b = this.store.getBookmark(id);
    if (!b) return { error: 'not_found' };
    const out = {};
    if (patch.url != null) {
      const url = String(patch.url).trim();
      const clash = this.store.db.bookmarks.find(x => x.id !== id && normalizeUrl(x.url) === normalizeUrl(url));
      if (clash) return { error: 'duplicate', existing: clash };
      out.url = url;
    }
    if (patch.title != null) out.title = String(patch.title).trim() || (out.url || b.url);
    if (patch.description != null) out.description = String(patch.description);
    if (patch.note != null) out.note = String(patch.note);
    if (patch.tags != null) out.tags = dedupeTags(patch.tags, this.store.db.bookmarks.filter(x => x.id !== id));
    if (patch.read != null) out.read = !!patch.read;
    if (patch.archived != null) out.archived = !!patch.archived;
    return { bookmark: this.store.updateBookmark(id, out) };
  }

  deleteBookmark(id) {
    const b = this.store.getBookmark(id);
    if (!b) return { error: 'not_found' };
    this.store.deleteSnapshot(id, b.preserved && b.preserved.kind);
    this.store.deleteBookmark(id);
    return { ok: true };
  }

  // Retry capturing a copy for a bookmark that has none (SCN-008, SCN-014).
  async retry(id) {
    const b = this.store.getBookmark(id);
    if (!b) return { error: 'not_found' };
    const cap = await capture(b.url, this.capOpts);
    if (cap.readable === false) return { bookmark: b, readable: false };
    const now = Date.now();
    const kind = cap.kind || (isPdf(b.url) ? 'pdf' : 'page');
    if (kind === 'pdf') this.store.writeSnapshot(id, 'pdf', cap.pdfBuffer);
    else this.store.writeSnapshot(id, 'page', cap.snapshotHtml);
    const patch = {
      contentCollected: true,
      preserved: { status: 'saved', savedAt: now, kind, archiveUrl: (b.preserved && b.preserved.archiveUrl) || null },
    };
    // fill only still-blank fields (SCN-008)
    if (!b.title || b.title === b.url) patch.title = cap.title || b.title;
    if (!b.description) patch.description = cap.description || '';
    return { bookmark: this.store.updateBookmark(id, patch), readable: true };
  }

  async sendToArchive(id) {
    const b = this.store.getBookmark(id);
    if (!b) throw new Error('not_found');
    const fetchImpl = this.capOpts.fetch || globalThis.fetch;
    if (!fetchImpl) throw new Error('no_network');
    const res = await fetchImpl('https://web.archive.org/save/' + b.url, { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('archive_failed');
    b.preserved = Object.assign({}, b.preserved, { archiveUrl: 'https://web.archive.org/web/*/' + b.url });
    this.store.updateBookmark(id, { preserved: b.preserved });
    return b;
  }

  // Bulk actions on an explicit id list (SCN-015). The client computes
  // "all matching" and sends the ids.
  bulk(action, ids, payload = {}) {
    const set = new Set(ids || []);
    const targets = this.store.db.bookmarks.filter(b => set.has(b.id));
    let n = 0;
    for (const b of targets) {
      switch (action) {
        case 'read': b.read = true; n++; break;
        case 'unread': b.read = false; n++; break;
        case 'archive': b.archived = true; n++; break;
        case 'restore': b.archived = false; n++; break;
        case 'addTag': {
          const c = canonTag(payload.tag, this.allExistingTags());
          if (!(b.tags || []).some(x => x.toLowerCase() === c.toLowerCase())) { (b.tags = b.tags || []).push(c); }
          n++; break;
        }
        case 'removeTag': {
          const lc = String(payload.tag).toLowerCase();
          b.tags = (b.tags || []).filter(x => x.toLowerCase() !== lc); n++; break;
        }
        default: break;
      }
    }
    if (action === 'delete') {
      for (const b of targets) { this.store.deleteSnapshot(b.id, b.preserved && b.preserved.kind); }
      this.store.db.bookmarks = this.store.db.bookmarks.filter(b => !set.has(b.id));
      n = targets.length;
    }
    this.store._save();
    return { count: n };
  }

  allExistingTags() {
    const s = [];
    this.store.db.bookmarks.forEach(b => (b.tags || []).forEach(t => s.push(t)));
    return s;
  }

  // Import a browser bookmarks file (SCN-017).
  importNetscape(html) {
    const items = parseNetscape(html);
    let added = 0, skipped = 0;
    for (const it of items) {
      if (!it.url) continue;
      if (this.findByAddress(it.url)) { skipped++; continue; }
      const tags = dedupeTags(it.tags, this.store.db.bookmarks);
      const kind = isPdf(it.url) ? 'pdf' : 'page';
      this.store.addBookmark({
        url: it.url, title: it.title, description: '', tags,
        note: '', read: false, archived: false,
        createdAt: it.addDate || Date.now(),
        contentCollected: true,
        preserved: { status: 'none', savedAt: null, kind, archiveUrl: null },
      });
      added++;
    }
    return { added, skipped };
  }

  exportNetscape() { return buildNetscape(this.store.db.bookmarks); }

  // saved searches / prefs
  addSavedSearch(ss) { return this.store.addSavedSearch({ name: ss.name, query: ss.query || '', status: ss.status || 'all', location: ss.location || 'active' }); }
  deleteSavedSearch(id) { this.store.deleteSavedSearch(id); return { ok: true }; }
  setPrefs(p) { return this.store.setPrefs(p); }
}

module.exports = { Service, dedupeTags };
