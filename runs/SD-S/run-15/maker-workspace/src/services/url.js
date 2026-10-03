/**
 * Normalize and validate a user-supplied web address.
 *
 * - Trims surrounding whitespace.
 * - Adds a default "https://" scheme when none is present (e.g. "example.com").
 * - Accepts only http/https URLs; anything else throws.
 *
 * Returns the normalized address string. Throws InvalidUrlError on bad input.
 */
export class InvalidUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export function normalizeUrl(raw) {
  if (raw == null || typeof raw !== 'string' || raw.trim() === '') {
    throw new InvalidUrlError('A web address is required.');
  }

  let candidate = raw.trim();

  // Add a scheme when the input has none (e.g. "example.com/path").
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new InvalidUrlError('That does not look like a valid web address.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError('Only http and https addresses are supported.');
  }

  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new InvalidUrlError('That does not look like a valid web address.');
  }

  return parsed.toString();
}
