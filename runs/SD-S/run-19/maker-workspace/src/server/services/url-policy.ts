import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

export type UrlPolicyCode = 'INVALID_URL' | 'UNSAFE_URL';

export class UrlPolicyError extends Error {
  constructor(
    public readonly code: UrlPolicyCode,
    message: string,
  ) {
    super(message);
    this.name = 'UrlPolicyError';
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface NormalizedUrl {
  url: URL;
  canonical: string;
  normalized: string;
}

const LOCAL_HOST_PATTERN = /(^|\.)(localhost|local)$/i;

export function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

export function canonicalizeUrl(input: string): NormalizedUrl {
  const value = input.trim();
  if (!value || value.length > 2048) {
    throw new UrlPolicyError('INVALID_URL', 'Enter a complete web address that is 2,048 characters or fewer.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new UrlPolicyError('INVALID_URL', 'Enter a complete web address beginning with http:// or https://.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlPolicyError('INVALID_URL', 'Only http:// and https:// web addresses can be saved.');
  }
  if (parsed.username || parsed.password) {
    throw new UrlPolicyError('UNSAFE_URL', 'Web addresses containing embedded credentials are not supported.');
  }
  if (!parsed.hostname) {
    throw new UrlPolicyError('INVALID_URL', 'The web address must include a hostname.');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (LOCAL_HOST_PATTERN.test(hostname)) {
    throw new UrlPolicyError('UNSAFE_URL', 'Local and private network addresses cannot be fetched.');
  }
  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new UrlPolicyError('UNSAFE_URL', 'Local and private network addresses cannot be fetched.');
  }

  parsed.hash = '';
  const canonical = parsed.toString();
  return { url: parsed, canonical, normalized: canonical };
}

export const defaultAddressResolver: AddressResolver = async (hostname) => {
  const hostnameWithoutBrackets = hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostnameWithoutBrackets)) {
    return [{ address: hostnameWithoutBrackets, family: isIP(hostnameWithoutBrackets) as 4 | 6 }];
  }
  const addresses = await dnsLookup(hostnameWithoutBrackets, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
};

export async function resolvePublicAddresses(
  hostname: string,
  resolver: AddressResolver = defaultAddressResolver,
): Promise<ResolvedAddress[]> {
  const hostnameWithoutBrackets = hostname.replace(/^\[|\]$/g, '');
  if (LOCAL_HOST_PATTERN.test(hostnameWithoutBrackets)) {
    throw new UrlPolicyError('UNSAFE_URL', 'Local and private network addresses cannot be fetched.');
  }
  const addresses = await resolver(hostnameWithoutBrackets);
  if (addresses.length === 0) {
    throw new Error('The destination hostname did not resolve.');
  }
  if (addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new UrlPolicyError('UNSAFE_URL', 'The web address resolves to a local or private network.');
  }
  return addresses;
}

export function fallbackTitleForUrl(input: string): string {
  const { url } = canonicalizeUrl(input);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const rawSegment = pathSegments.at(-1);
  let detail = '';
  if (rawSegment) {
    try {
      detail = decodeURIComponent(rawSegment);
    } catch {
      detail = rawSegment;
    }
    detail = detail.replace(/\.[a-z0-9]{1,6}$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const host = url.hostname.replace(/^www\./i, '');
  const title = detail ? `${detail.charAt(0).toUpperCase()}${detail.slice(1)} · ${host}` : host;
  return title.slice(0, 300);
}

export function normalizeTag(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
