// Shared URL helpers used by both the server and the browser.
// UMD wrapper so the same file works under Node (require) and in the browser (window.LL_urls).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LL_urls = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Add a scheme if the client omitted one (assume https), per SCN-001.
  function normUrl(url) {
    let u = String(url == null ? "" : url).trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u;
  }

  // Host without a leading "www.".
  function hostOf(url) {
    try {
      return new URL(normUrl(url)).hostname.replace(/^www\./i, "");
    } catch (e) {
      return String(url == null ? "" : url).trim();
    }
  }

  // Canonical form for duplicate detection (SCN-008):
  // scheme, leading www., trailing slash and #fragment are ignored; query string is significant.
  function canon(url) {
    let u = normUrl(url).toLowerCase();
    u = u.replace(/^https?:\/\//, "");
    u = u.replace(/^www\./, "");
    u = u.replace(/#.*$/, "");
    u = u.replace(/\/+$/, "");
    return u;
  }

  // A plausible web address: no whitespace, and a dotted host (or localhost). SCN-011.
  function isPlausibleUrl(raw) {
    const s = String(raw == null ? "" : raw).trim();
    if (!s || /\s/.test(s)) return false;
    const stripped = s.replace(/^https?:\/\//i, "");
    const host = stripped.split(/[\/?#]/)[0];
    return /^localhost(:\d+)?$/i.test(host) || /^[^.\s]+(\.[^.\s]+)+$/.test(host);
  }

  // Direct link to a PDF file (SCN-007).
  function isPdf(url) {
    return /\.pdf($|[?#])/i.test(String(url == null ? "" : url));
  }

  return { normUrl, hostOf, canon, isPlausibleUrl, isPdf };
});
