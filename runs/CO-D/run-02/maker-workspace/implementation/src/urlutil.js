'use strict';
// URL normalisation, duplicate keys, title guessing, PDF detection, tag cleaning.
// Implements the address-equivalence used by saving/import (SCN-002, SCN-019)
// and tag normalisation (SCN-004).

function normalise(raw) {
  let v = (raw || '').trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try { return new URL(v); } catch (e) { return null; }
}

function keyOf(u) {
  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  const p = u.pathname.replace(/\/+$/, '');
  return host + p + (u.search || '');
}

function hostOf(u) { return u.hostname.replace(/^www\./i, ''); }

function guessTitle(u) {
  let p = decodeURIComponent(u.pathname).replace(/\/+$/, '');
  let last = p.split('/').filter(Boolean).pop();
  if (last) {
    last = last.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
    if (last) return last.charAt(0).toUpperCase() + last.slice(1);
  }
  return hostOf(u);
}

function isPdf(url) { return /\.pdf($|[?#])/i.test(url || ''); }

function cleanTag(t) {
  return (t || '').trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase();
}

function uniq(arr) {
  const out = [];
  (arr || []).forEach(x => { if (x && out.indexOf(x) === -1) out.push(x); });
  return out;
}

module.exports = { normalise, keyOf, hostOf, guessTitle, isPdf, cleanTag, uniq };
