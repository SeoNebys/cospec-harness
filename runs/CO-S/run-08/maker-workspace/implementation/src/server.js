'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { Store } = require('./store');
const { normalizeUrl, sameLink } = require('./urls');

const COOKIE = 'sid';
const STAY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (SCN-011 "keep me signed in")

/**
 * Build the Express app. A store file path may be injected for testing.
 * @param {object} [opts]
 * @param {string} [opts.storeFile]
 * @returns {import('express').Express}
 */
function createApp(opts = {}) {
  const storeFile = opts.storeFile || path.join(__dirname, '..', 'data', 'db.json');
  const store = new Store(storeFile);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // --- auth helpers ---
  function setSessionCookie(res, token, stay) {
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // review/dev over http; production settings kept separate
      maxAge: stay ? STAY_MAX_AGE_MS : undefined, // undefined => session cookie
    });
  }

  function currentSession(req) {
    return store.getSession(req.cookies && req.cookies[COOKIE]);
  }

  function requireAuth(req, res, next) {
    if (!currentSession(req)) return res.status(401).json({ error: 'not_authenticated' });
    next();
  }

  // --- session / account (SCN-011) ---
  app.get('/api/session', (req, res) => {
    const authed = !!currentSession(req);
    res.json({
      authenticated: authed,
      accountExists: store.accountExists(),
      email: authed && store.getAccount() ? store.getAccount().email : null,
    });
  });

  app.post('/api/register', (req, res) => {
    const { email, password, confirm, stay } = req.body || {};
    if (store.accountExists()) {
      return res.status(409).json({ error: 'account_exists' });
    }
    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (password !== confirm) {
      return res.status(400).json({ error: 'password_mismatch' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    store.createAccount(String(email).trim(), passwordHash);
    const token = store.createSession(stay ? STAY_MAX_AGE_MS : null);
    setSessionCookie(res, token, stay);
    res.json({ ok: true, email: store.getAccount().email });
  });

  app.post('/api/login', (req, res) => {
    const { email, password, stay } = req.body || {};
    const account = store.getAccount();
    if (!account) return res.status(400).json({ error: 'no_account' });
    const emailOk = account.email.toLowerCase() === String(email || '').trim().toLowerCase();
    const pwOk = !!password && bcrypt.compareSync(String(password), account.passwordHash);
    if (!emailOk || !pwOk) {
      return res.status(401).json({ error: 'invalid_credentials' }); // SCN-011 wrong credentials
    }
    const token = store.createSession(stay ? STAY_MAX_AGE_MS : null);
    setSessionCookie(res, token, stay);
    res.json({ ok: true, email: account.email });
  });

  app.post('/api/logout', (req, res) => {
    store.destroySession(req.cookies && req.cookies[COOKIE]);
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  });

  // --- bookmarks (SCN-001..SCN-010) ---
  app.get('/api/bookmarks', requireAuth, (req, res) => {
    res.json({ bookmarks: store.listBookmarks() });
  });

  app.post('/api/bookmarks', requireAuth, (req, res) => {
    const { url, title, topic } = req.body || {};
    const raw = String(url == null ? '' : url).trim();
    if (!raw) return res.status(400).json({ error: 'address_required' }); // SCN-010
    const normalized = normalizeUrl(raw); // SCN-009
    const existing = store.findByUrl(sameLink, normalized); // SCN-008
    if (existing) {
      return res.status(200).json({ duplicate: true, bookmark: existing });
    }
    const created = store.addBookmark({
      url: normalized,
      title: String(title == null ? '' : title).trim(),
      topic: String(topic == null ? '' : topic).trim(),
    });
    res.status(201).json({ created: true, bookmark: created });
  });

  app.put('/api/bookmarks/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const { url, title, topic } = req.body || {};
    const raw = String(url == null ? '' : url).trim();
    if (!raw) return res.status(400).json({ error: 'address_required' }); // SCN-004/010
    const normalized = normalizeUrl(raw); // SCN-009
    // A duplicate that is not this same record blocks the edit into a clash.
    const clash = store.listBookmarks().find((b) => b.id !== id && sameLink(b.url, normalized));
    if (clash) return res.status(409).json({ error: 'duplicate', bookmark: clash });
    const updated = store.updateBookmark(id, {
      url: normalized,
      title: String(title == null ? '' : title).trim(),
      topic: String(topic == null ? '' : topic).trim(),
    });
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json({ updated: true, bookmark: updated });
  });

  app.delete('/api/bookmarks/:id', requireAuth, (req, res) => {
    const ok = store.deleteBookmark(Number(req.params.id)); // SCN-005
    if (!ok) return res.status(404).json({ error: 'not_found' });
    res.json({ deleted: true });
  });

  // --- static frontend ---
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.store = store;
  return app;
}

module.exports = { createApp };
