export class UrlPolicyError extends Error {}

export interface NormalizedUrl { submittedUrl: string; fetchUrl: string; canonicalKey: string; hostname: string }

export function normalizeUrl(input: string): NormalizedUrl {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 4096) throw new UrlPolicyError('Enter a web address up to 4,096 characters.');
  let url: URL;
  try { url = new URL(trimmed); } catch { throw new UrlPolicyError('Enter a complete web address, including http:// or https://.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UrlPolicyError('Only HTTP and HTTPS web addresses are supported.');
  if (url.username || url.password) throw new UrlPolicyError('Web addresses containing credentials are not supported.');
  if (!url.hostname) throw new UrlPolicyError('The web address needs a host name.');
  url.hash = '';
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) url.port = '';
  if (url.pathname === '') url.pathname = '/';
  const canonical = new URL(url.href);
  if (canonical.pathname === '') canonical.pathname = '/';
  return { submittedUrl: trimmed, fetchUrl: url.href, canonicalKey: canonical.href, hostname: url.hostname };
}

export function fallbackTitle(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./i, '') || url; } catch { return url; }
}
