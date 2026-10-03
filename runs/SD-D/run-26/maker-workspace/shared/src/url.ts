import { AppError } from './errors.js';

export function parseHttpUrl(input: string): URL {
  let value: URL;
  try {
    value = new URL(input.trim());
  } catch {
    throw new AppError(
      422,
      'BAD_REQUEST',
      'Enter a complete web address, such as https://example.com.'
    );
  }
  if (value.protocol !== 'http:' && value.protocol !== 'https:')
    throw new AppError(422, 'BAD_REQUEST', 'Only HTTP and HTTPS addresses can be saved.');
  if (!value.hostname) throw new AppError(422, 'BAD_REQUEST', 'The web address needs a host name.');
  return value;
}
export function urlKey(input: string): string {
  return parseHttpUrl(input).href;
}
