/*
 * store.js — the bookmark collection: state, persistence, and the operations
 * that mutate it. Built on core.js. Persistence is injectable (real
 * localStorage in the browser, an in-memory object in tests).
 *
 * UMD, like core.js: window.BookmarkStore in the browser, require() in Node.
 *
 * Scenario coverage: SCN-004 (add + duplicate guard), SCN-005 (update + link
 * collision), SCN-006 (set aside / bring back / delete / undo data),
 * SCN-009 (sort preference persistence), SCN-010 (reading state).
 */
(function (root, factory) {
  const api = factory(
    (typeof module === 'object' && module.exports) ? require('./core.js') : root.BookmarkCore
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookmarkStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';

  var ITEMS_KEY = 'bm_items_v1';
  var SORT_KEY = 'bm_sort';

  // A storage that keeps everything in memory — the default, and what tests use.
  function memoryStorage() {
    const m = Object.create(null);
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); }
    };
  }

  function createStore(options) {
    options = options || {};
    const storage = options.storage || memoryStorage();
    let items = load();
    if (options.seed && items.length === 0) { items = options.seed.slice(); persist(); }

    function load() {
      try {
        const raw = storage.getItem(ITEMS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
      } catch (e) { return []; }
    }
    function persist() {
      try { storage.setItem(ITEMS_KEY, JSON.stringify(items)); } catch (e) { /* storage full/blocked */ }
    }
    function normalizeItem(it) {
      return {
        added: it.added || 0,
        url: it.url || '',
        title: it.title || '(untitled)',
        source: it.source || '',
        desc: it.desc || '',
        note: it.note || '',
        date: it.date || '',
        tags: Array.isArray(it.tags) ? it.tags.slice() : [],
        unread: !!it.unread,
        aside: !!it.aside
      };
    }
    function nextAdded() {
      return items.reduce(function (m, b) { return Math.max(m, b.added || 0); }, 0) + 1;
    }

    return {
      all: function () { return items; },

      // Filtered + ordered view for the main list. (delegates to core)
      view: function (criteria) { return core.selectView(items, criteria); },
      asideItems: function () { return core.asideItems(items); },
      unreadCount: function () { return core.unreadCount(items); },
      labels: function () { return core.labelVocabulary(items); },
      canonicalLabel: function (typed) { return core.canonicalLabel(items, typed); },
      find: function (url) { return core.findByUrl(items, url); },

      // SCN-004: never create a second copy of a link already saved.
      add: function (input) {
        const existing = core.findByUrl(items, input.url);
        if (existing) return { duplicate: true, item: existing };
        const it = normalizeItem({
          added: nextAdded(),
          url: input.url,
          title: input.title || '(untitled)',
          source: input.source || core.readableName(core.hostOf(input.url)) || 'Unknown site',
          desc: input.desc || '',
          note: input.note || '',
          date: input.date || 'Saved just now',
          tags: input.tags || [],
          unread: !!input.unread
        });
        items.unshift(it);
        persist();
        return { added: true, item: it };
      },

      // SCN-005: edit fields; a changed link must not collide with another bookmark.
      update: function (url, changes) {
        const it = core.findByUrl(items, url);
        if (!it) return { ok: false, notFound: true };
        if (changes.url != null && core.normalizeUrl(changes.url) !== core.normalizeUrl(it.url)) {
          const clash = core.findByUrl(items, changes.url, it);
          if (clash) return { ok: false, clash: clash };
        }
        ['url', 'title', 'source', 'desc', 'note'].forEach(function (k) {
          if (changes[k] != null) it[k] = changes[k];
        });
        if (changes.tags != null) it.tags = changes.tags.slice();
        if (changes.unread != null) it.unread = !!changes.unread;
        if (!it.title) it.title = '(untitled)';
        persist();
        return { ok: true, item: it };
      },

      setAside: function (url, val) { const it = core.findByUrl(items, url); if (it) { it.aside = val !== false; persist(); } return it; },
      setUnread: function (url, val) { const it = core.findByUrl(items, url); if (it) { it.unread = val !== false; persist(); } return it; },

      // SCN-006: delete returns the item + its index so it can be un-deleted.
      remove: function (url) {
        const it = core.findByUrl(items, url);
        if (!it) return null;
        const index = items.indexOf(it);
        items.splice(index, 1);
        persist();
        return { item: it, index: index };
      },
      insertAt: function (item, index) {
        items.splice(Math.max(0, Math.min(index, items.length)), 0, item);
        persist();
        return item;
      },

      // SCN-009: the sort preference is remembered across visits.
      getSort: function () { return core.normalizeSort(storage.getItem(SORT_KEY)); },
      setSort: function (s) { try { storage.setItem(SORT_KEY, core.normalizeSort(s)); } catch (e) {} }
    };
  }

  return { createStore: createStore, memoryStorage: memoryStorage, ITEMS_KEY: ITEMS_KEY, SORT_KEY: SORT_KEY };
});
