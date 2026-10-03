'use strict';

const path = require('path');
const express = require('express');
const logic = require('./logic');
const { fetchTitle: realFetchTitle } = require('./titleFetcher');

/**
 * Build the Express app. Dependencies are injected so tests can supply an
 * in-memory store and a stub title fetcher.
 *
 * @param {object} opts
 * @param {{load:Function, save:Function}} opts.store
 * @param {Function} [opts.fetchTitle] async (url) => { ok, title }
 */
function createApp({ store, fetchTitle = realFetchTitle }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // In-memory working state, persisted through the store on every change.
  const state = store.load();

  function persist() {
    store.save(state);
  }

  function publicBookmark(b) {
    return {
      id: b.id,
      url: b.url,
      title: b.title,
      titleFailed: !!b.titleFailed,
      tags: b.tags.slice(),
      readLater: !!b.readLater,
      read: !!b.read,
      host: logic.hostLabel(b.url),
      createdAt: b.createdAt,
    };
  }

  function snapshot() {
    return {
      bookmarks: state.bookmarks.map(publicBookmark),
      allTags: logic.allTags(state.bookmarks),
      unreadCount: logic.unreadCount(state.bookmarks),
      total: state.bookmarks.length,
    };
  }

  // List everything the UI needs; filtering/searching happens in the client
  // (SCN-003/004) but is also covered by unit tests on logic.filterBookmarks.
  app.get('/api/bookmarks', (req, res) => {
    res.json(snapshot());
  });

  // Save a new link (SCN-001, SCN-005 invalid, SCN-006 duplicate).
  app.post('/api/bookmarks', async (req, res) => {
    const url = logic.normaliseUrl(req.body && req.body.url);
    if (!url) {
      return res.status(400).json({ error: 'invalid_url' });
    }
    const existing = logic.findDuplicate(state.bookmarks, url);
    if (existing) {
      return res.status(409).json({ duplicate: true, bookmark: publicBookmark(existing) });
    }
    let title = url;
    let titleFailed = false;
    try {
      const result = await fetchTitle(url);
      if (result && result.ok && result.title) {
        title = result.title;
      } else {
        titleFailed = true;
      }
    } catch (e) {
      titleFailed = true;
    }
    const bookmark = {
      id: state.nextId++,
      url,
      title,
      titleFailed,
      tags: [],
      readLater: !!(req.body && req.body.readLater),
      read: false,
      createdAt: new Date().toISOString(),
    };
    state.bookmarks.unshift(bookmark); // newest first (SCN-001)
    persist();
    res.status(201).json({ bookmark: publicBookmark(bookmark) });
  });

  // Update a bookmark: rename, tags, read-later membership, read status
  // (SCN-001 rename, SCN-002 tags, SCN-004 read-later/read).
  app.patch('/api/bookmarks/:id', (req, res) => {
    const id = Number(req.params.id);
    const b = state.bookmarks.find((x) => x.id === id);
    if (!b) return res.status(404).json({ error: 'not_found' });
    const body = req.body || {};

    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (t) {
        b.title = t;
        b.titleFailed = false; // client provided a real name
      }
    }
    if (Array.isArray(body.tags)) {
      const seen = [];
      body.tags.forEach((raw) => {
        const t = logic.normaliseTag(raw);
        if (t && !seen.includes(t)) seen.push(t);
      });
      b.tags = seen;
    }
    if (typeof body.readLater === 'boolean') {
      b.readLater = body.readLater;
      if (!b.readLater) b.read = false; // leaving read-later clears read status
    }
    if (typeof body.read === 'boolean') {
      // Read status only meaningful for read-later items.
      b.read = b.readLater ? body.read : false;
    }
    persist();
    res.json({ bookmark: publicBookmark(b) });
  });

  // Delete a bookmark permanently (SCN-007). Confirmation happens in the UI.
  app.delete('/api/bookmarks/:id', (req, res) => {
    const id = Number(req.params.id);
    const idx = state.bookmarks.findIndex((x) => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not_found' });
    state.bookmarks.splice(idx, 1);
    persist();
    res.status(204).end();
  });

  return app;
}

module.exports = { createApp };
