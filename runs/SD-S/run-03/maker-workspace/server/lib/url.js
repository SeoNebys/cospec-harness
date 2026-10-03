// URL validation and normalization for bookmarks.
// Accepts only http/https web addresses; normalizes for storage and duplicate
// detection (data-model.md, FR-002, FR-009).

export class InvalidUrlError extends Error {
  constructor(message = 'Please enter a valid http or https web address.') {
    super(message);
    this.code = 'invalid_url';
  }
}

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

/**
 * Validate and normalize a web address.
 * @param {string} input raw user-supplied address
 * @returns {string} normalized absolute URL
 * @throws {InvalidUrlError} if malformed or not http/https
 */
export function normalizeUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new InvalidUrlError('A web address is required.');
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new InvalidUrlError();
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidUrlError('Only http and https web addresses are supported.');
  }

  // Lowercase scheme and host (URL already lowercases these), strip default port.
  if (url.port && DEFAULT_PORTS[url.protocol] === url.port) {
    url.port = '';
  }

  // Collapse an empty path to "/".
  if (url.pathname === '') {
    url.pathname = '/';
  }

  return url.toString();
}

/**
 * Validate without throwing.
 * @returns {boolean}
 */
export function isValidUrl(input) {
  try {
    normalizeUrl(input);
    return true;
  } catch {
    return false;
  }
}
