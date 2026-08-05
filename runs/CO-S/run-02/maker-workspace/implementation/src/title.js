/*
 * title.js — pure extraction of a page title from HTML.
 * Kept separate and pure so it is testable without a network (SCN-002/007).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BMTitle = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Decode the handful of HTML entities commonly seen in <title>.
  function decodeEntities(s) {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); });
  }

  // Return the trimmed <title> text, or null if none is present.
  function extractTitle(html) {
    if (typeof html !== 'string') return null;
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) return null;
    const text = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    return text || null;
  }

  return { extractTitle: extractTitle, decodeEntities: decodeEntities };
});
