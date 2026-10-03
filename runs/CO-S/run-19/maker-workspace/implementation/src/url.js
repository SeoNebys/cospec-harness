const TRACKING_KEYS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  'igshid', 'vero_id', 'oly_anon_id', 'oly_enc_id',
]);

export class InvalidUrlError extends Error {
  constructor(message = 'Enter a complete web address, such as https://example.com/article') {
    super(message);
    this.name = 'InvalidUrlError';
    this.code = 'invalid_url';
    this.status = 400;
  }
}

export function parseWebUrl(value) {
  if (typeof value !== 'string' || !value.trim()) throw new InvalidUrlError();
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new InvalidUrlError();
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new InvalidUrlError();
  }
  return parsed;
}

export function canonicalizeUrl(value) {
  const parsed = parseWebUrl(value);
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
    parsed.port = '';
  }
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_KEYS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString();
}

export function displayHost(value) {
  return parseWebUrl(value).hostname.replace(/^www\./i, '');
}
