// URL helpers: normalization for deduplication and domain extraction.

// Tracking / analytics params that should not create distinct bookmarks.
const STRIP_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_reader', 'utm_name', 'utm_social', 'utm_social-type',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'igshid', 'ref', 'ref_src',
  'ref_url', 'yclid', 'msclkid', '_ga', 'spm', 'scm',
]);

export function ensureProtocol(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (/^(mailto|tel):/i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

// Produce a canonical key used to detect duplicate URLs. Two URLs that differ
// only by protocol case, default port, trailing slash, tracking params, a
// leading "www.", or fragment collapse to the same key.
export function normalizeUrl(raw) {
  const withProto = ensureProtocol(raw);
  let u;
  try {
    u = new URL(withProto);
  } catch {
    return withProto.toLowerCase();
  }
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';

  // Drop default ports.
  if ((u.protocol === 'http:' && u.port === '80') ||
      (u.protocol === 'https:' && u.port === '443')) {
    u.port = '';
  }

  // Remove tracking params, then sort the rest for stable ordering.
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !STRIP_PARAMS.has(k.toLowerCase()))
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  u.search = '';
  for (const [k, v] of params) u.searchParams.append(k, v);

  // Collapse trailing slash on the path (but keep root "/").
  let key = u.toString();
  key = key.replace(/\/(\?|$)/, '$1');
  // Treat http and https as the same resource for deduplication.
  key = key.replace(/^http:\/\//, 'https://');
  return key;
}

export function extractDomain(raw) {
  try {
    return new URL(ensureProtocol(raw)).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
