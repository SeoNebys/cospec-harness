import { ValidationError } from '../models/bookmark';

// Address handling for bookmarks. Fully offline: we never fetch pages over the
// network. See research.md Decision 4 and data-model.md validation rules.

/**
 * Normalize a user-entered address:
 * - trims surrounding whitespace
 * - assumes https:// when no scheme is present
 * - validates the result is a well-formed http/https URL
 *
 * @throws ValidationError when the input is empty or not a valid http(s) URL.
 */
export function normalizeUrl(input: string): string {
  const trimmed = (input ?? '').trim();
  if (trimmed === '') {
    throw new ValidationError('Please enter a web address.');
  }

  const withScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new ValidationError('That doesn’t look like a valid web address.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Only http and https web addresses are supported.');
  }

  return parsed.href;
}

/** True when the input normalizes to a valid http/https address. */
export function isValidUrl(input: string): boolean {
  try {
    normalizeUrl(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive a readable default title from an address (host + path), used when the
 * user leaves the title blank. Never fetches the page.
 */
export function deriveTitle(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
  return `${parsed.host}${path}`;
}
