// Address and tag normalisation / validation.
// Basis: SCN-008 (invalid/empty address, missing-scheme forgiveness),
//        SCN-002/SCN-006 (tag lower-casing and de-duplication),
//        SCN-007 (duplicate detection by address, ignoring trailing slash).

export function normalizeUrl(raw) {
  let s = (raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s; // SCN-008: forgive missing scheme
  return s;
}

export function isValidUrl(u) {
  try {
    const p = new URL(u);
    return (p.protocol === 'http:' || p.protocol === 'https:')
      && !!p.hostname && p.hostname.includes('.');
  } catch {
    return false;
  }
}

// Canonical form for duplicate comparison: ignore a trailing slash (SCN-007).
export function canonicalUrl(u) {
  return (u || '').replace(/\/+$/, '');
}

export function sameUrl(a, b) {
  return canonicalUrl(a) === canonicalUrl(b);
}

export function normalizeTag(t) {
  return (t || '').trim().replace(/^#/, '').toLowerCase();
}

export function normalizeTags(tags) {
  const out = [];
  for (const raw of (tags || [])) {
    const t = normalizeTag(raw);
    if (t && !out.includes(t)) out.push(t); // lower-cased + de-duplicated
  }
  return out;
}

// Parse a comma-separated tag string (used by the edit form).
export function parseTagString(s) {
  return normalizeTags((s || '').split(','));
}

export function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
