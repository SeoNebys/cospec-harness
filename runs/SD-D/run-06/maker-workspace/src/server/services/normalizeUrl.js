// URL normalization + validation (FR-002).
//
// Rules:
//  - default a missing scheme to https://
//  - lowercase scheme and host
//  - remove a redundant trailing slash on a path-less URL
//  - preserve path/query/fragment case
//  - reject empty / malformed input
//
// Returns { url, normalized } where `url` is a tidied canonical form suitable to
// store as entered, and `normalized` is the duplicate-detection key.

export class InvalidUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export function normalizeUrl(input) {
  if (input == null || typeof input !== 'string' || input.trim() === '') {
    throw new InvalidUrlError('Address is required');
  }

  let raw = input.trim();

  // Default a missing scheme to https://. Only add it when there is no scheme
  // present (avoid mangling values like "mailto:" which we reject below).
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      throw new InvalidUrlError('Only http and https addresses are supported');
    }
    raw = 'https://' + raw;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new InvalidUrlError('Address is not a valid URL');
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new InvalidUrlError('Only http and https addresses are supported');
  }
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new InvalidUrlError('Address must include a valid host');
  }

  // Lowercase scheme + host (URL already lowercases these); preserve the rest.
  parsed.protocol = scheme;
  parsed.hostname = parsed.hostname.toLowerCase();

  // Build the normalized form. Drop a redundant trailing slash when the path is
  // just "/" and there is no query/fragment (path-less URL).
  let path = parsed.pathname;
  const hasQuery = parsed.search && parsed.search !== '?';
  const hasHash = parsed.hash && parsed.hash !== '#';
  if (path === '/' && !hasQuery && !hasHash) {
    path = '';
  }

  const normalized = `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`;

  return { url: parsed.toString(), normalized };
}
