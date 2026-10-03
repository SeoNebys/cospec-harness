import { validateHttpUrl } from './validate-url.js';

/** Produce the deliberately conservative identity key approved in the spec. */
export function normalizeUrl(value: string): string {
  const { input, parsed } = validateHttpUrl(value);
  const authorityStart = input.indexOf('//') + 2;
  const tailStartCandidate = input.slice(authorityStart).search(/[/?#]/);
  const tailStart = tailStartCandidate < 0 ? input.length : authorityStart + tailStartCandidate;
  const rawTail = input.slice(tailStart);
  let port = parsed.port;
  if ((parsed.protocol === 'http:' && port === '80') || (parsed.protocol === 'https:' && port === '443')) port = '';
  const bareHost = parsed.hostname.replace(/^\[|\]$/gu,'').toLowerCase();
  const host = bareHost.includes(':') ? `[${bareHost}]` : bareHost;
  const authority = `${parsed.protocol.toLowerCase()}//${host}${port ? `:${port}` : ''}`;
  return authority + (!rawTail ? '/' : rawTail.startsWith('/') ? rawTail : `/${rawTail}`);
}

export function outboundUrl(value: string): URL {
  const { parsed } = validateHttpUrl(value);
  parsed.hash = '';
  return parsed;
}
