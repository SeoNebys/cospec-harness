export class UrlValidationError extends Error {}

export interface NormalizedUrl {
  url: string;
  normalizedUrl: string;
  fallbackTitle: string;
}

export function normalizeUrl(input: string): NormalizedUrl {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048)
    throw new UrlValidationError('Enter an HTTP or HTTPS address up to 2,048 characters.');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UrlValidationError('Enter a complete web address, such as https://example.com.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname)
    throw new UrlValidationError('Only HTTP and HTTPS web addresses can be saved.');
  if (parsed.username || parsed.password)
    throw new UrlValidationError('Web addresses containing credentials cannot be saved.');
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';
  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  )
    parsed.port = '';
  if (!parsed.pathname) parsed.pathname = '/';
  const normalizedUrl = parsed.toString();
  let fallbackTitle = parsed.hostname.replace(/^www\./, '');
  let decodedPath = parsed.pathname;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    // Keep the URL parser's safe serialized path when percent escapes are malformed.
  }
  const usefulPath = decodedPath.split('/').filter(Boolean).at(-1)?.replace(/[-_]+/g, ' ').trim();
  if (usefulPath) fallbackTitle = `${usefulPath} — ${fallbackTitle}`;
  return {
    url: normalizedUrl,
    normalizedUrl,
    fallbackTitle: [...fallbackTitle].slice(0, 200).join('') || 'Untitled bookmark',
  };
}
