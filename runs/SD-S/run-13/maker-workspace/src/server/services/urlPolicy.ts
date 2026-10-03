import { resolve4, resolve6 } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export class InvalidUrlError extends Error {}
export class UnsafeUrlError extends Error {}

export function normalizeUrl(input: string): URL {
  let value = input.trim();
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
  let url: URL;
  try { url = new URL(value); } catch { throw new InvalidUrlError('Enter a valid web address.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new InvalidUrlError('Only HTTP and HTTPS addresses are supported.');
  if (url.username || url.password) throw new InvalidUrlError('Addresses containing credentials are not supported.');
  url.hash = '';
  return url;
}

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) return isPublicAddress((parsed as ipaddr.IPv6).toIPv4Address().toString());
    return parsed.range() === 'unicast';
  } catch { return false; }
}

export type Resolver = (hostname: string) => Promise<string[]>;
export const defaultResolver: Resolver = async (hostname) => {
  if (ipaddr.isValid(hostname)) return [hostname];
  const [v4, v6] = await Promise.all([resolve4(hostname).catch(() => []), resolve6(hostname).catch(() => [])]);
  return [...v4, ...v6];
};

export async function validatePublicUrl(url: URL, resolver: Resolver = defaultResolver): Promise<string[]> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new UnsafeUrlError('Only public HTTP and HTTPS destinations are allowed.');
  const addresses = await resolver(url.hostname);
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) throw new UnsafeUrlError('This address does not resolve to a public website.');
  return addresses;
}

export function fallbackTitle(url: URL): string { return url.hostname.replace(/^www\./i, '') || url.href.slice(0, 200); }
export function normalizedComparisonUrl(input: string): string { return normalizeUrl(input).href; }
