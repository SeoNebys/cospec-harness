const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'mkt_tok'
]);

export class InvalidAddressError extends Error {
  constructor(message = 'Enter a full web address, including https://') {
    super(message);
    this.name = 'InvalidAddressError';
  }
}

export function parseWebAddress(value) {
  let parsed;
  try {
    parsed = new URL(String(value ?? '').trim());
  } catch {
    throw new InvalidAddressError();
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new InvalidAddressError('Enter a web address that begins with http:// or https://');
  }

  if (!parsed.hostname) throw new InvalidAddressError();
  return parsed;
}

export function cleanDisplayAddress(value) {
  const parsed = parseWebAddress(value);
  parsed.hash = '';
  return parsed.href;
}

export function canonicalizeAddress(value) {
  const parsed = parseWebAddress(value);
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMETERS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.searchParams.sort();
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.href;
}

export function websiteName(value) {
  return parseWebAddress(value).hostname.toLowerCase().replace(/^www\./, '');
}

export function tidyLabel(value) {
  const trimmed = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}
