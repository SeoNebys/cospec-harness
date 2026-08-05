/*
 * store.js — persistence via the browser's localStorage.
 *
 * Satisfies the confirmed requirement that saved links survive closing and
 * reopening the browser on this computer (single device, no sync).
 */
(function (root) {
  "use strict";

  var KEY = "bookmarks.v1";

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      // Defensive: keep only well-formed records.
      return data.filter(function (it) {
        return it && typeof it.url === "string" && typeof it.key === "string";
      }).map(function (it) {
        return {
          url: it.url,
          host: it.host || "",
          title: it.title || it.host || it.url,
          tags: Array.isArray(it.tags) ? it.tags : [],
          key: it.key
        };
      });
    } catch (e) {
      return [];
    }
  }

  function save(items) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      return false;
    }
  }

  root.BMStore = { load: load, save: save, KEY: KEY };
})(typeof window !== "undefined" ? window : this);
