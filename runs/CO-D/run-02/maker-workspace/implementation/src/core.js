/*
 * core.js — pure domain logic for the bookmarks app.
 *
 * No DOM, no storage, no globals mutated. Everything here is a pure function so
 * it can be unit-tested in Node and reused unchanged in the browser.
 *
 * Loaded two ways (UMD):
 *   - Browser: as a classic script tag  ->  window.BookmarkCore
 *   - Node:    const core = require('../src/core.js')
 *
 * Scenario coverage: SCN-001 (finding), SCN-002 (roundups/labels),
 * SCN-004/008 (link normalisation, metadata), SCN-009 (ordering),
 * SCN-010 (reading state), plus the aside filtering of SCN-006.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookmarkCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --- links -------------------------------------------------------------

  // Parse a user-typed string into a URL, tolerating a missing protocol.
  // Returns a URL object, or null when it isn't a plausible web address. (SCN-008)
  function asUrl(input) {
    let s = String(input == null ? '' : input).trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try {
      const u = new URL(s);
      return u.hostname.includes('.') ? u : null;
    } catch (e) {
      return null;
    }
  }

  // The identity of a link for duplicate detection: ignore protocol, "www.",
  // trailing slashes and case. (SCN-004)
  function normalizeUrl(input) {
    return String(input == null ? '' : input)
      .trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  }

  function hostOf(input) {
    const u = asUrl(input);
    return u ? u.hostname.replace(/^www\./, '') : '';
  }

  // A human-friendly fallback name derived from a host ("nytimes.com" -> "Nytimes").
  function readableName(host) {
    if (!host) return '';
    const base = host.replace(/^www\./, '').split('.')[0];
    return base.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // --- searching (SCN-001) ----------------------------------------------

  function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Split a query into words. Spaces and order don't matter; each word matters.
  function tokenize(query) {
    return String(query == null ? '' : query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  // The text a bookmark is searchable by: its title, page summary, the client's
  // own note, the readable site name, and the host. (SCN-001, SCN-004 note)
  function haystack(item) {
    return [item.title, item.desc, item.note, item.source, hostOf(item.url)]
      .filter(Boolean).join(' ').toLowerCase();
  }

  // A word matches from the START of a word only ("read" hits "reading",
  // not "bread"). Every typed word must match somewhere. (SCN-001)
  function itemMatches(item, tokens) {
    if (!tokens.length) return true;
    const hay = haystack(item);
    return tokens.every(function (tok) {
      return new RegExp('\\b' + escapeRegExp(tok), 'i').test(hay);
    });
  }

  // --- ordering (SCN-009) -----------------------------------------------

  var SORTS = { newest: 1, oldest: 1, az: 1 };
  function normalizeSort(sort) { return SORTS[sort] ? sort : 'newest'; }

  function sortItems(items, sort) {
    const a = items.slice();
    sort = normalizeSort(sort);
    if (sort === 'az') a.sort(function (x, y) { return x.title.toLowerCase().localeCompare(y.title.toLowerCase()); });
    else if (sort === 'oldest') a.sort(function (x, y) { return (x.added || 0) - (y.added || 0); });
    else a.sort(function (x, y) { return (y.added || 0) - (x.added || 0); });
    return a;
  }

  // --- the view pipeline -------------------------------------------------

  // Turn the whole collection into what should be on screen, given the current
  // criteria. Set-aside items are always excluded from the main views (SCN-006);
  // the reading filter (SCN-010) and label roundup (SCN-002) and text search
  // (SCN-001) all compose (AND), then the chosen order is applied (SCN-009).
  function selectView(items, criteria) {
    const c = criteria || {};
    let out = items.filter(function (it) { return !it.aside; });
    if (c.reading) out = out.filter(function (it) { return !!it.unread; });
    if (c.tag) out = out.filter(function (it) { return (it.tags || []).indexOf(c.tag) !== -1; });
    const tokens = tokenize(c.search || '');
    if (tokens.length) out = out.filter(function (it) { return itemMatches(it, tokens); });
    return sortItems(out, c.sort);
  }

  function asideItems(items) { return items.filter(function (it) { return it.aside; }); }
  function unreadCount(items) { return items.filter(function (it) { return !it.aside && it.unread; }).length; }

  // Distinct labels present on the (non-aside) main list — the roundup
  // vocabulary. Order of first appearance. (SCN-002; excludes aside per SCN-006)
  function labelVocabulary(items) {
    const seen = [];
    items.forEach(function (it) {
      if (it.aside) return;
      (it.tags || []).forEach(function (t) { if (seen.indexOf(t) === -1) seen.push(t); });
    });
    return seen;
  }

  // Normalise a typed label to an existing one when it matches case-insensitively,
  // so "recipe"/"Recipe" don't split into separate piles. (SCN-004)
  function canonicalLabel(items, typed) {
    const v = String(typed || '').trim();
    if (!v) return '';
    const all = [];
    items.forEach(function (it) { (it.tags || []).forEach(function (t) { if (all.indexOf(t) === -1) all.push(t); }); });
    const hit = all.find(function (t) { return t.toLowerCase() === v.toLowerCase(); });
    return hit || v;
  }

  function findByUrl(items, url, except) {
    const n = normalizeUrl(url);
    if (!n) return null;
    return items.find(function (it) { return it !== except && it.url && normalizeUrl(it.url) === n; }) || null;
  }

  // --- metadata (auto-fill on save) -------------------------------------
  //
  // A best-effort resolver for a pasted link. A static, install-free page cannot
  // fetch arbitrary cross-origin pages (browser CORS), so full auto-read of any
  // page needs a small fetch service — deferred and documented in design-decisions.
  // Until then: recognise a seeded set, otherwise derive the readable site name
  // and leave the title for the client (the graceful path of SCN-008).
  var KNOWN = {
    'smittenkitchen.com': { title: 'The best olive oil cake, ever', source: 'Smitten Kitchen', desc: 'A one-bowl olive oil cake with a crackly top — plush, citrusy, and impossible to mess up.' },
    'seriouseats.com': { source: 'Serious Eats' },
    'nytimes.com': { source: 'The New York Times' },
    'theatlantic.com': { source: 'The Atlantic' },
    'css-tricks.com': { source: 'CSS-Tricks' },
    'martinfowler.com': { source: 'Martin Fowler' }
  };

  function resolveMetadata(input) {
    const u = asUrl(input);
    if (!u) return null;
    const host = u.hostname.replace(/^www\./, '');
    const known = KNOWN[host];
    const source = (known && known.source) || readableName(host);
    if (known && known.title) {
      return { title: known.title, source: source, desc: known.desc || '', autofilled: true };
    }
    return { title: '', source: source, desc: '', autofilled: false };
  }

  return {
    asUrl: asUrl,
    normalizeUrl: normalizeUrl,
    hostOf: hostOf,
    readableName: readableName,
    escapeRegExp: escapeRegExp,
    tokenize: tokenize,
    haystack: haystack,
    itemMatches: itemMatches,
    normalizeSort: normalizeSort,
    sortItems: sortItems,
    selectView: selectView,
    asideItems: asideItems,
    unreadCount: unreadCount,
    labelVocabulary: labelVocabulary,
    canonicalLabel: canonicalLabel,
    findByUrl: findByUrl,
    resolveMetadata: resolveMetadata
  };
});
