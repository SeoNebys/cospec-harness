export class UrlPolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'UrlPolicyError';
  }
}

export function parsePublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UrlPolicyError('INVALID_URL', 'Enter a complete HTTP or HTTPS address.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlPolicyError('UNSUPPORTED_SCHEME', 'Only HTTP and HTTPS addresses can be saved.');
  }
  if (url.username || url.password) throw new UrlPolicyError('URL_CREDENTIALS', 'Addresses containing credentials are not allowed.');
  const port = url.port;
  if (port && !((url.protocol === 'http:' && port === '80') || (url.protocol === 'https:' && port === '443'))) {
    throw new UrlPolicyError('UNSUPPORTED_PORT', 'Only standard HTTP and HTTPS ports are allowed.');
  }
  return url;
}

export function normalizeBookmarkUrl(value: string): string {
  const url = parsePublicHttpUrl(value);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) url.port = '';
  if (!url.pathname) url.pathname = '/';
  return url.toString();
}

export function fallbackTitle(value: string): string {
  const url = parsePublicHttpUrl(value);
  const segment = url.pathname.split('/').filter(Boolean).at(-1);
  return segment ? `${url.hostname} · ${decodeURIComponent(segment).replace(/[-_]+/gu, ' ')}`.slice(0, 300) : url.hostname.slice(0, 300);
}
