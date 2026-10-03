import { LIMITS } from '../config/limits.js';

export interface ValidatedUrl {
  input: string;
  parsed: URL;
}

export function validateHttpUrl(value: unknown): ValidatedUrl {
  if (typeof value !== 'string') throw new Error('Enter a web address.');
  const input = value.trim();
  if (!input) throw new Error('Enter a web address.');
  if ([...input].length > LIMITS.urlLength) throw new Error('The web address is too long.');
  let parsed: URL;
  try { parsed = new URL(input); } catch { throw new Error('Enter a complete web address, including http:// or https://.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Only HTTP and HTTPS web addresses can be saved.');
  if (parsed.username || parsed.password) throw new Error('Web addresses containing credentials cannot be saved.');
  if (!parsed.hostname) throw new Error('Enter a web address with a host name.');
  return { input, parsed };
}
