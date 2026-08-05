// Address validation + normalization (FR-002, FR-014).

const VALID_HINT =
  'Enter a full web address starting with http:// or https://, e.g. https://example.com';

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export const invalidUrlHint = VALID_HINT;

// A stable key for duplicate detection: trim, and lower-case the scheme and host
// (which are case-insensitive) while leaving the path/query untouched. Trivial
// casing/whitespace differences collapse; genuinely different pages do not.
export function normalizeUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.protocol = u.protocol.toLowerCase();
  u.host = u.host.toLowerCase();
  return u.toString();
}
