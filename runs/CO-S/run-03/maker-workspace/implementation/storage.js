/*
 * Persistence (browser only).
 * Bookmarks are stored in localStorage so they are still there when the user
 * comes back. No login/account — this is the user's own browser (design D1).
 */
(function (root) {
  'use strict';
  const KEY = 'bookmarks.v1';

  root.BookmarksStorage = {
    load: function () {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return [];
        // Be tolerant of older/partial records.
        return data
          .filter(function (it) { return it && typeof it.url === 'string'; })
          .map(function (it) {
            return {
              id: it.id,
              url: it.url,
              normKey: it.normKey || null,
              title: it.title || it.url,
              groups: Array.isArray(it.groups) ? it.groups : []
            };
          });
      } catch (e) {
        return [];
      }
    },
    save: function (items) {
      try {
        localStorage.setItem(KEY, JSON.stringify(items));
        return true;
      } catch (e) {
        return false;
      }
    }
  };
})(typeof self !== 'undefined' ? self : this);
