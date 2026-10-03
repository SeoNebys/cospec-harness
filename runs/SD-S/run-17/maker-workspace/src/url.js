// URL validation, normalisation, and dedupe-key helpers.
// Implements FR-002 (validate), FR-003 (normalise missing scheme), and the
// dedupe key used for FR-010 (duplicate detection).

/**
 * Normalise a user-entered address into a canonical http/https URL string.
 * - Trims surrounding whitespace.
 * - Prepends "https://" when no scheme is present (FR-003).
 * - Rejects anything that is not a valid http/https URL (FR-002).
 *
 * @param {string} input
 * @returns {string} the normalised absolute URL
 * @throws {Error} with a user-actionable message when the address is invalid
 */
export function normalize(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('Please enter a web address.');
  }
  let candidate = input.trim();

  // If there is no scheme (e.g. "example.com/path"), default to https.
  // A leading "//" is treated as scheme-relative and also gets https.
  const schemeMatch = candidate.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
  // A bare scheme like "javascript:..." or "mailto:..." — a scheme token with no
  // dot (to avoid mistaking "example.com:8080" for a scheme) followed by ":".
  const bareScheme = candidate.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(?!\/\/)/);

  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      throw new Error('Only http and https web addresses are supported.');
    }
  } else if (bareScheme && !bareScheme[1].includes('.')) {
    const scheme = bareScheme[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      throw new Error('Only http and https web addresses are supported.');
    }
  } else if (candidate.startsWith('//')) {
    candidate = 'https:' + candidate;
  } else {
    candidate = 'https://' + candidate;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('That does not look like a valid web address.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https web addresses are supported.');
  }
  if (!url.hostname || !url.hostname.includes('.')) {
    throw new Error('That does not look like a valid web address.');
  }

  return url.toString();
}

/**
 * Compute a normalised dedupe key for an address so that trivially different
 * spellings of the same page collapse together (FR-010). Uses lowercased host
 * plus path, ignoring a trailing slash, and ignoring scheme, query, and fragment.
 *
 * @param {string} normalizedUrl a URL string (ideally already normalised)
 * @returns {string}
 */
export function dedupeKey(normalizedUrl) {
  const url = new URL(normalizedUrl);
  const host = url.hostname.toLowerCase();
  let path = url.pathname || '/';
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return host + path;
}
