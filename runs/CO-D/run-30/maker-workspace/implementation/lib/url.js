const TRACKING_KEYS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  '_hsenc',
  '_hsmi',
  'mkt_tok',
  'vero_id',
  'oly_anon_id',
  'oly_enc_id'
]);

export class InvalidUrlError extends Error {
  constructor(message = 'Enter a full web address beginning with http:// or https://.') {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export function parseWebUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) {
    throw new InvalidUrlError();
  }

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

export function normalizeUrl(value) {
  const parsed = parseWebUrl(value);
  parsed.hash = '';

  for (const key of [...parsed.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || TRACKING_KEYS.has(lower)) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.searchParams.sort();
  return parsed.href;
}

export function siteNameFromUrl(value) {
  const parsed = parseWebUrl(value);
  return parsed.hostname.replace(/^www\./i, '');
}

export function displayUrl(value) {
  const parsed = parseWebUrl(value);
  return `${parsed.hostname.replace(/^www\./i, '')}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

