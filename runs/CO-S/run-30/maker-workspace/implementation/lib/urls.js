import { AppError } from './errors.js';

export function canonicalizeUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value ?? '').trim());
  } catch {
    throw new AppError('INVALID_URL', 'Enter a full web address, such as https://example.com', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new AppError('INVALID_URL', 'Enter a full web address, such as https://example.com', 400);
  }

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
    parsed.port = '';
  }
  if (parsed.pathname === '/') parsed.pathname = '';
  return parsed.toString();
}

export function sourceFromUrl(value) {
  return new URL(value).hostname.replace(/^www\./i, '');
}
