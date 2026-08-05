/*
 * core.js — pure bookmark logic (no DOM, no storage).
 *
 * Kept free of browser APIs so it can be unit-tested under Node and reused by
 * the UI. Maps directly to approved scenarios SCN-001..SCN-007.
 * Exported both to `window.BM` (browser) and `module.exports` (Node tests).
 */
(function (root) {
  "use strict";

  // SCN-006: "looks like a link" heuristic — needs a dot and a domain-like
  // structure; a leading http(s):// is optional. Not full URL validation.
  function looksLikeLink(raw) {
    if (typeof raw !== "string") return false;
    var s = raw.trim();
    if (!s || /\s/.test(s)) return false;
    var withoutScheme = s.replace(/^https?:\/\//i, "");
    // must have a host label, a dot, and a TLD of >= 2 chars
    return /^[^\s./]+(\.[^\s./]+)*\.[a-z]{2,}(\/|$|\?|#)/i.test(withoutScheme);
  }

  function normalizeUrl(raw) {
    var s = raw.trim();
    return /^https?:\/\//i.test(s) ? s : "https://" + s;
  }

  function hostOf(raw) {
    var s = raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    return s.split(/[/?#]/)[0];
  }

  // SCN-001: readable title guessed from the last path segment, else the site.
  function titleGuess(raw) {
    var s = raw.trim().replace(/^https?:\/\//i, "");
    var path = s.split(/[?#]/)[0].split("/").filter(Boolean).slice(1).join(" / ");
    if (path) {
      try { path = decodeURIComponent(path); } catch (e) { /* keep raw */ }
      return path.replace(/[-_]+/g, " ").replace(/\.[a-z0-9]+$/i, "").trim();
    }
    return hostOf(raw);
  }

  // SCN-007: duplicate detection ignores scheme, leading www., trailing slash.
  function dedupeKey(raw) {
    return raw.trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }

  // SCN-003: comma-separated, trimmed, lower-cased, de-duplicated, order kept.
  function parseTags(str) {
    if (!str) return [];
    var seen = Object.create(null);
    var out = [];
    str.split(",").forEach(function (t) {
      var tag = t.trim().toLowerCase();
      if (tag && !seen[tag]) { seen[tag] = true; out.push(tag); }
    });
    return out;
  }

  function makeItem(raw, tagsStr) {
    return {
      url: normalizeUrl(raw),
      host: hostOf(raw),
      title: titleGuess(raw),
      tags: parseTags(tagsStr),
      key: dedupeKey(raw)
    };
  }

  // SCN-002 / SCN-003 / SCN-005: match title + host + tags against the query.
  function matches(item, query) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return true;
    var hay = (item.title + " " + item.host + " " + item.tags.join(" ")).toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function filterItems(items, query) {
    return items.filter(function (it) { return matches(it, query); });
  }

  /*
   * Attempt to add a link. Pure: returns a result describing the outcome and,
   * when something changed, a NEW items array (never mutates the input).
   *   status: "empty" | "invalid" | "duplicate" | "added"
   * Covers SCN-001, SCN-003, SCN-006, SCN-007.
   */
  function addLink(items, rawInput, tagsStr) {
    var raw = (rawInput || "").trim();
    if (!raw) return { status: "empty", items: items };
    if (!looksLikeLink(raw)) return { status: "invalid", items: items };

    var key = dedupeKey(raw);
    for (var i = 0; i < items.length; i++) {
      if (items[i].key === key) {
        return { status: "duplicate", items: items, key: key };
      }
    }
    var item = makeItem(raw, tagsStr);
    return { status: "added", items: [item].concat(items), key: item.key };
  }

  var api = {
    looksLikeLink: looksLikeLink,
    normalizeUrl: normalizeUrl,
    hostOf: hostOf,
    titleGuess: titleGuess,
    dedupeKey: dedupeKey,
    parseTags: parseTags,
    makeItem: makeItem,
    matches: matches,
    filterItems: filterItems,
    addLink: addLink
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BM = api;
})(typeof window !== "undefined" ? window : this);
