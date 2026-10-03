import { AppError } from '../api/errors.js';

export function parseBookmarkUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AppError(422, 'invalid_url', 'Enter a valid web address.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError(422, 'invalid_url', 'Only http and https addresses can be saved.');
  }
  if (url.username || url.password) {
    throw new AppError(422, 'invalid_url', 'Addresses containing embedded credentials cannot be saved.');
  }
  if (url.href.length > 4096)
    throw new AppError(422, 'invalid_url', 'Use an address of 4096 characters or fewer.');
  return url;
}

export function normalizeBookmarkUrl(input: string): { original: string; normalized: string } {
  const url = parseBookmarkUrl(input);
  url.hash = '';
  url.hostname = url.hostname.toLocaleLowerCase('en-US').replace(/\.$/, '');
  if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
    url.port = '';
  }
  if (!url.pathname) url.pathname = '/';
  return { original: input.trim(), normalized: url.href };
}
