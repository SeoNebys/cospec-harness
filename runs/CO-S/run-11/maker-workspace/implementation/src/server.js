'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { openDb, createDataStore } = require('./db');
const { isValidUrl, normalizeUrl } = require('./url');
const { fetchMetadata } = require('./metadata');
const { hashPassword, verifyPassword, newSessionToken, isValidEmail } = require('./auth');

const COOKIE = 'sid';

function createApp(store, opts = {}) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  // ---- auth middleware ----
  function currentUser(req) {
    return store.getSessionUser(req.cookies && req.cookies[COOKIE]);
  }
  function requireAuth(req, res, next) {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'not signed in' });
    req.user = user;
    next();
  }
  function setSession(res, userId) {
    const token = newSessionToken();
    store.createSession(token, userId);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  }

  // ---- accounts (SCN-013) ----
  app.post('/api/register', (req, res) => {
    const { email, password } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Choose a password of at least 6 characters.' });
    }
    if (store.getUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    const user = store.createUser(email, hashPassword(password));
    setSession(res, user.id);
    res.json({ email: user.email });
  });

  app.post('/api/login', (req, res) => {
    const { email, password } = req.body || {};
    const user = store.getUserByEmail(email);
    if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
      return res.status(401).json({ error: "That email or password isn't right." });
    }
    setSession(res, user.id);
    res.json({ email: user.email });
  });

  app.post('/api/logout', (req, res) => {
    const token = req.cookies && req.cookies[COOKIE];
    if (token) store.destroySession(token);
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'not signed in' });
    res.json({ email: user.email });
  });

  // ---- metadata auto-fill (SCN-001 / SCN-009) ----
  app.get('/api/metadata', requireAuth, async (req, res) => {
    const url = req.query.url;
    if (!isValidUrl(url)) return res.status(400).json({ error: 'invalid url' });
    try {
      const meta = await fetchMetadata(url, { fetchImpl: opts.fetchImpl });
      res.json({ ok: true, title: meta.title, description: meta.description });
    } catch {
      // Auto-fill is a convenience; failure must never block saving.
      res.json({ ok: false, title: '', description: '' });
    }
  });

  // ---- bookmarks ----
  app.get('/api/bookmarks', requireAuth, (req, res) => {
    res.json({
      bookmarks: store.listBookmarks(req.user.id),
      tags: store.listTags(req.user.id),
    });
  });

  app.post('/api/bookmarks', requireAuth, (req, res) => {
    const { url, title, description, note, tags } = req.body || {};
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: "That doesn't look like a web link — it should start with http:// or https://" });
    }
    const normUrl = normalizeUrl(url);
    const existing = store.findByNormUrl(req.user.id, normUrl);
    if (existing) {
      // SCN-006: no duplicate; point the client at the existing bookmark.
      return res.status(409).json({ duplicate: true, bookmark: existing });
    }
    const bm = store.createBookmark(req.user.id, {
      url: url.trim(),
      normUrl,
      title: (title || '').trim(),
      description: (description || '').trim(),
      note: (note || '').trim(),
      tags: tags || [],
      finished: false,
      archived: false,
    });
    res.status(201).json({ bookmark: bm });
  });

  app.put('/api/bookmarks/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const current = store.getBookmark(req.user.id, id);
    if (!current) return res.status(404).json({ error: 'not found' });
    const { url, title, description, note, tags } = req.body || {};
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: "That doesn't look like a web link — it should start with http:// or https://" });
    }
    const normUrl = normalizeUrl(url);
    const clash = store.findByNormUrl(req.user.id, normUrl);
    if (clash && clash.id !== id) {
      return res.status(409).json({ conflict: true, error: 'Another saved bookmark already uses this address.' });
    }
    const bm = store.updateBookmark(req.user.id, id, {
      url: url.trim(),
      normUrl,
      title: (title || '').trim(),
      description: (description || '').trim(),
      note: (note || '').trim(),
      tags: tags || [],
    });
    res.json({ bookmark: bm });
  });

  app.patch('/api/bookmarks/:id/status', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const bm = store.setFinished(req.user.id, id, !!(req.body && req.body.finished));
    if (!bm) return res.status(404).json({ error: 'not found' });
    res.json({ bookmark: bm });
  });

  app.patch('/api/bookmarks/:id/archived', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const bm = store.setArchived(req.user.id, id, !!(req.body && req.body.archived));
    if (!bm) return res.status(404).json({ error: 'not found' });
    res.json({ bookmark: bm });
  });

  app.delete('/api/bookmarks/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const ok = store.deleteBookmark(req.user.id, id);
    if (!ok) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  });

  // ---- static frontend ----
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

function seedReviewAccount(store) {
  const email = process.env.REVIEW_EMAIL || 'demo@bookmarks.test';
  const password = process.env.REVIEW_PASSWORD || 'demo123';
  if (!store.getUserByEmail(email)) {
    store.createUser(email, hashPassword(password));
    // eslint-disable-next-line no-console
    console.log(`Seeded review account: ${email} / ${password}`);
  }
  return { email, password };
}

if (require.main === module) {
  const db = openDb();
  const store = createDataStore(db);
  seedReviewAccount(store);
  const app = createApp(store);
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`Bookmarks app listening on http://0.0.0.0:${port}`);
  });
}

module.exports = { createApp, seedReviewAccount };
