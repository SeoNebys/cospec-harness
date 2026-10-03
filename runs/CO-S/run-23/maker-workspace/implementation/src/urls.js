const TRACKING_KEYS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid'
]);

function parseWebAddress(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new TypeError('Enter a complete web address, such as https://example.com');
  }

  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new TypeError('Enter a complete web address, such as https://example.com');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('Enter a complete web address, such as https://example.com');
  }

  return url;
}

function canonicalizeAddress(raw) {
  const url = parseWebAddress(raw);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();

  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('utm_') || TRACKING_KEYS.has(normalized)) {
      url.searchParams.delete(key);
    }
  }

  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
}

module.exports = { canonicalizeAddress, parseWebAddress };
