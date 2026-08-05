// URL validation and normalization used before saving a bookmark (FR-002) and
// to enforce one-bookmark-per-address (FR-017).

// Accepts only well-formed http/https addresses.
export function isValidWebUrl(input: string): boolean {
  try {
    const u = new URL(input.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// Canonical form used for duplicate detection: lowercased host, no default
// port, no trailing slash on an empty path, no fragment. Two addresses that
// point at the same page compare equal so we never store a confusing duplicate.
export function normalizeUrl(input: string): string {
  const u = new URL(input.trim())
  u.hash = ''
  u.hostname = u.hostname.toLowerCase()
  if (
    (u.protocol === 'http:' && u.port === '80') ||
    (u.protocol === 'https:' && u.port === '443')
  ) {
    u.port = ''
  }
  // Drop a trailing slash so "/a" and "/a/" (and the bare host with/without "/")
  // are treated as the same page for duplicate detection.
  if (!u.search && u.pathname.endsWith('/') && u.pathname !== '') {
    u.pathname = u.pathname.replace(/\/+$/, '')
  }
  return u.toString()
}
