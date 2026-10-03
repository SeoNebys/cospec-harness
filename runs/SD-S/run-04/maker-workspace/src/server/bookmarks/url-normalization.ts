import { AppError } from '../../shared/contracts/problems.js';

export function parseHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AppError(422, 'VALIDATION_ERROR', 'Enter a valid web address.', {
      issues: [{ field: 'url', message: 'Enter a complete HTTP or HTTPS address.' }],
    });
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new AppError(422, 'VALIDATION_ERROR', 'Enter a valid web address.', {
      issues: [
        { field: 'url', message: 'Use an HTTP or HTTPS address without embedded credentials.' },
      ],
    });
  return url;
}

export function normalizeUrl(value: string): string {
  const url = parseHttpUrl(value);
  url.hash = '';
  url.hostname = url.hostname.toLocaleLowerCase();
  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  )
    url.port = '';
  if (!url.pathname) url.pathname = '/';
  return url.toString();
}
