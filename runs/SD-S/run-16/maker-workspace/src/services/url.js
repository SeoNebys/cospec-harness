// URL validation and normalization (research §9, FR-002/FR-003/FR-011).

export class InvalidUrlError extends Error {
  constructor(message = 'Enter a valid web address.') {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

/**
 * Validate and normalize a user-entered address.
 * - Scheme-less input defaults to https://
 * - Only http/https with a non-empty host are accepted
 * Returns { url, normalizedUrl }:
 *   url            - the openable address (scheme guaranteed)
 *   normalizedUrl  - canonical key for duplicate detection
 * Throws InvalidUrlError on anything that is not a usable web address.
 */
export function validateAndNormalize(input) {
  if (input === undefined || input === null) throw new InvalidUrlError();
  const raw = String(input).trim();
  if (raw === '') throw new InvalidUrlError();

  // Default scheme-less input to https:// (FR-003).
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)
    ? raw
    : `https://${raw}`;

  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new InvalidUrlError();
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError();
  }
  if (!parsed.hostname) {
    throw new InvalidUrlError();
  }

  const url = parsed.href;
  const normalizedUrl = normalize(parsed);
  return { url, normalizedUrl };
}

function normalize(parsed) {
  const scheme = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();

  // Drop default ports.
  const defaultPort =
    (scheme === 'http:' && parsed.port === '80') ||
    (scheme === 'https:' && parsed.port === '443');
  const port = parsed.port && !defaultPort ? `:${parsed.port}` : '';

  // Remove a trailing slash when the path is just "/".
  let path = parsed.pathname;
  if (path === '/') path = '';

  const search = parsed.search || '';
  return `${scheme}//${host}${port}${path}${search}`;
}
