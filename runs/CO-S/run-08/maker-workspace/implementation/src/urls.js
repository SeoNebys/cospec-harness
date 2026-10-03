'use strict';

// Address handling for bookmarks.
// Basis: SCN-009 (add missing scheme) and SCN-008 (duplicate detection by
// normalized address, ignoring trailing slashes / scheme / case).

/**
 * Ensure an address has an http(s) scheme. Only a missing scheme is added;
 * the address is not otherwise rewritten. (SCN-009)
 * @param {string} raw
 * @returns {string}
 */
function normalizeUrl(raw) {
  const u = String(raw == null ? '' : raw).trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return 'https://' + u;
}

/**
 * Canonical form used only for duplicate comparison: normalized, without a
 * trailing slash, lower-cased. (SCN-008)
 * @param {string} raw
 * @returns {string}
 */
function canonicalUrl(raw) {
  return normalizeUrl(raw).replace(/\/+$/, '').toLowerCase();
}

/**
 * Whether two addresses refer to the same link for duplicate purposes. (SCN-008)
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function sameLink(a, b) {
  const ca = canonicalUrl(a);
  return ca !== '' && ca === canonicalUrl(b);
}

module.exports = { normalizeUrl, canonicalUrl, sameLink };
