'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple durable JSON store. The app is single-owner (SCN-011), so a single
// JSON document holds the one account, its bookmarks, and active sessions.
// Central server-side storage is what lets the same links appear on every
// device the owner signs in from (SCN-011).

function nowMs() { return Date.now(); }

class Store {
  constructor(file) {
    this.file = file;
    this.data = { account: null, bookmarks: [], sessions: {}, seq: 0 };
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = Object.assign({ account: null, bookmarks: [], sessions: {}, seq: 0 }, parsed);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this._save();
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // atomic replace
  }

  // --- account (SCN-011) ---
  accountExists() { return !!this.data.account; }

  getAccount() { return this.data.account; }

  createAccount(email, passwordHash) {
    this.data.account = { email, passwordHash, createdAt: nowMs() };
    this._save();
    return this.data.account;
  }

  // --- sessions (SCN-011) ---
  createSession(maxAgeMs) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = maxAgeMs ? nowMs() + maxAgeMs : null; // null = session cookie
    this.data.sessions[token] = { createdAt: nowMs(), expiresAt };
    this._save();
    return token;
  }

  getSession(token) {
    if (!token) return null;
    const s = this.data.sessions[token];
    if (!s) return null;
    if (s.expiresAt && s.expiresAt < nowMs()) {
      this.destroySession(token);
      return null;
    }
    return s;
  }

  destroySession(token) {
    if (token && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this._save();
    }
  }

  // --- bookmarks (SCN-001..SCN-010) ---
  listBookmarks() {
    return this.data.bookmarks.map((b) => ({ ...b }));
  }

  findByUrl(sameLinkFn, url) {
    return this.data.bookmarks.find((b) => sameLinkFn(b.url, url)) || null;
  }

  getBookmark(id) {
    return this.data.bookmarks.find((b) => b.id === id) || null;
  }

  addBookmark({ url, title, topic }) {
    const b = { id: ++this.data.seq, url, title: title || '', topic: topic || '', createdAt: nowMs() };
    this.data.bookmarks.push(b);
    this._save();
    return { ...b };
  }

  updateBookmark(id, { url, title, topic }) {
    const b = this.getBookmark(id);
    if (!b) return null;
    b.url = url;
    b.title = title || '';
    b.topic = topic || '';
    this._save();
    return { ...b };
  }

  deleteBookmark(id) {
    const idx = this.data.bookmarks.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    this.data.bookmarks.splice(idx, 1);
    this._save();
    return true;
  }
}

module.exports = { Store };
