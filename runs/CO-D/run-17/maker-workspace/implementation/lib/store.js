/*
 * store.js — single-user, server-synced persistence (NF-003/NF-004).
 * The whole library ({ links, preferences, savedViews }) is one JSON document,
 * written atomically. The server is the single source of truth so any device
 * sees the same state.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const DEFAULT_PREFS = { defaultSort: "newest", perPage: "all", textSize: "normal" };

function emptyState() {
  return { links: [], preferences: { ...DEFAULT_PREFS }, savedViews: [], seq: 0 };
}

class Store {
  constructor(file) {
    this.file = file;
    this.state = emptyState();
    this._load();
  }
  _load() {
    try {
      const raw = fs.readFileSync(this.file, "utf8");
      const parsed = JSON.parse(raw);
      this.state = {
        links: Array.isArray(parsed.links) ? parsed.links : [],
        preferences: { ...DEFAULT_PREFS, ...(parsed.preferences || {}) },
        savedViews: Array.isArray(parsed.savedViews) ? parsed.savedViews : [],
        seq: Number.isFinite(parsed.seq) ? parsed.seq : 0,
      };
    } catch (e) {
      this.state = emptyState();
    }
  }
  _persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.file); // atomic replace
  }
  nextSeq() { return ++this.state.seq; }

  getState() {
    return { links: this.state.links, preferences: this.state.preferences, savedViews: this.state.savedViews };
  }
  findLink(id) { return this.state.links.find(l => l.id === id); }
  hasUrl(url, exceptId) { return this.state.links.some(l => l.url === url && l.id !== exceptId); }

  addLink(link) {
    const s = this.nextSeq();
    const rec = { ...link, createdSeq: s, updatedSeq: s };
    this.state.links.unshift(rec);
    this._persist();
    return rec;
  }
  updateLink(id, patch) {
    const l = this.findLink(id); if (!l) return null;
    Object.assign(l, patch);
    l.updatedSeq = this.nextSeq();
    this._persist();
    return l;
  }
  deleteLink(id) {
    const before = this.state.links.length;
    this.state.links = this.state.links.filter(l => l.id !== id);
    const changed = this.state.links.length !== before;
    if (changed) this._persist();
    return changed;
  }
  deleteLinks(ids) {
    const set = new Set(ids);
    this.state.links = this.state.links.filter(l => !set.has(l.id));
    this._persist();
  }
  bulkUpdate(ids, mutator) {
    const set = new Set(ids);
    for (const l of this.state.links) {
      if (set.has(l.id)) { mutator(l); l.updatedSeq = this.nextSeq(); }
    }
    this._persist();
  }

  setPreferences(patch) {
    this.state.preferences = { ...this.state.preferences, ...patch };
    this._persist();
    return this.state.preferences;
  }
  addSavedView(v) { this.state.savedViews.push(v); this._persist(); return v; }
  deleteSavedView(id) { this.state.savedViews = this.state.savedViews.filter(v => v.id !== id); this._persist(); }
}

module.exports = { Store, DEFAULT_PREFS, emptyState };
