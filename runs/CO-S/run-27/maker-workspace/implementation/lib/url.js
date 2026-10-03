export function parseWebAddress(input) {
  let parsed;
  try { parsed = new URL(String(input).trim()); } catch { throw new Error('Enter a complete web address.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Enter a web address starting with http:// or https://.');
  return parsed;
}

export function canonicalAddress(input) {
  return parseWebAddress(input).toString();
}

export function siteName(input) {
  return parseWebAddress(input).hostname.replace(/^www\./, '');
}
