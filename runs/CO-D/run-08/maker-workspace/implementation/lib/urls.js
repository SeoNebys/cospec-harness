const TRACKING_KEYS = new Set(['fbclid', 'gclid', 'dclid', 'msclkid']);

export function parseWebUrl(value) {
  let parsed;
  try { parsed = new URL(String(value).trim()); } catch { throw new Error('Enter a complete web address, such as https://example.com.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Enter a complete web address, such as https://example.com.');
  return parsed;
}

export function duplicateKey(value) {
  const parsed = value instanceof URL ? new URL(value.href) : parseWebUrl(value);
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || TRACKING_KEYS.has(lower)) parsed.searchParams.delete(key);
  }
  parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
  return parsed.href;
}
