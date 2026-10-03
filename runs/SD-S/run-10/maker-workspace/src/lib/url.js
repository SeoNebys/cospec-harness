// URL validation and normalization helpers (FR-003, scheme-less edge case).

/**
 * Normalize a user-entered address into a valid http/https URL string.
 * - Trims surrounding whitespace.
 * - Prepends "https://" when no scheme is present (e.g. "example.com").
 * - Accepts only http/https URLs.
 *
 * @param {string} input
 * @returns {string} the normalized URL
 * @throws {Error} if the input is empty or not a valid http/https URL
 */
export function normalizeUrl(input) {
  if (typeof input !== 'string') {
    throw new InvalidUrlError();
  }
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new InvalidUrlError();
  }

  // Add a scheme if the input looks scheme-less (no "scheme://" prefix).
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new InvalidUrlError();
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError();
  }
  // A hostname is required for a meaningful web address.
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new InvalidUrlError();
  }

  return parsed.toString();
}

export class InvalidUrlError extends Error {
  constructor() {
    super('Please enter a valid web address (for example, https://example.com).');
    this.name = 'InvalidUrlError';
  }
}
