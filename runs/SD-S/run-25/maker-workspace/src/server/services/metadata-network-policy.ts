import { isIP } from 'node:net';
import { promises as dns } from 'node:dns';
import { Address4, Address6 } from 'ip-address';

export interface MetadataDnsAddress {
  address: string;
  family: 4 | 6;
}

export type MetadataDnsLookup = (
  hostname: string,
) => Promise<readonly MetadataDnsAddress[]>;

export interface ValidatedMetadataDestination {
  url: URL;
  address: string;
  family: 4 | 6;
}

export class MetadataPolicyError extends Error {
  readonly code = 'METADATA_DESTINATION_BLOCKED';

  constructor(message = 'The page address is not available for automatic retrieval.') {
    super(message);
    this.name = 'MetadataPolicyError';
  }
}

const BLOCKED_V4_SUBNETS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
].map((subnet) => new Address4(subnet));

const BLOCKED_V6_SUBNETS = [
  '::/128',
  '::1/128',
  '64:ff9b:1::/48',
  '100::/64',
  '2001::/23',
  '2001:db8::/32',
  '2002::/16',
  '3fff::/20',
  'fc00::/7',
  'fe80::/10',
  'fec0::/10',
  'ff00::/8',
].map((subnet) => new Address6(subnet));

const IPV4_MAPPED = new Address6('::ffff:0:0/96');

function unbracketHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function isPublicIpv4(address: string): boolean {
  if (!Address4.isValid(address)) return false;
  const parsed = new Address4(address);
  return !BLOCKED_V4_SUBNETS.some((subnet) => parsed.isHostInSubnet(subnet));
}

function isPublicIpv6(address: string): boolean {
  if (!Address6.isValid(address)) return false;
  const parsed = new Address6(address);

  if (parsed.isHostInSubnet(IPV4_MAPPED) || parsed.getType() === 'IPv4-mapped') {
    return isPublicIpv4(parsed.to4().correctForm());
  }

  const nat64Address = parsed.toAddress4Nat64();
  if (nat64Address !== null && !isPublicIpv4(nat64Address.correctForm())) {
    return false;
  }

  return !BLOCKED_V6_SUBNETS.some((subnet) => parsed.isHostInSubnet(subnet));
}

/** Return true only for an address that may be reached across the public internet. */
export function isPublicAddress(address: string): boolean {
  const normalized = unbracketHostname(address);
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
}

function isLocalhostStyleName(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/u, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost');
}

/** Parse and enforce the URL-level portion of the metadata retrieval policy. */
export function parseMetadataUrl(input: string): URL {
  if (input.length > 4_096) throw new MetadataPolicyError();

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new MetadataPolicyError();
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new MetadataPolicyError();
  }
  if (url.username !== '' || url.password !== '') throw new MetadataPolicyError();

  const effectivePort = url.port || (url.protocol === 'https:' ? '443' : '80');
  if (effectivePort !== '80' && effectivePort !== '443') {
    throw new MetadataPolicyError();
  }
  if (isLocalhostStyleName(unbracketHostname(url.hostname))) {
    throw new MetadataPolicyError();
  }

  return url;
}

export const systemMetadataDnsLookup: MetadataDnsLookup = async (hostname) => {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.flatMap((result): MetadataDnsAddress[] =>
    result.family === 4 || result.family === 6
      ? [{ address: result.address, family: result.family }]
      : [],
  );
};

/** Resolve all answers, reject the complete set if any answer is unsafe, and select a pin. */
export async function validateMetadataDestination(
  input: string | URL,
  lookup: MetadataDnsLookup = systemMetadataDnsLookup,
): Promise<ValidatedMetadataDestination> {
  const url = input instanceof URL ? parseMetadataUrl(input.toString()) : parseMetadataUrl(input);
  const hostname = unbracketHostname(url.hostname);
  const literalFamily = isIP(hostname);

  if (literalFamily === 4 || literalFamily === 6) {
    if (!isPublicAddress(hostname)) throw new MetadataPolicyError();
    return { url, address: hostname, family: literalFamily };
  }

  let answers: readonly MetadataDnsAddress[];
  try {
    answers = await lookup(hostname);
  } catch {
    throw new MetadataPolicyError();
  }

  if (answers.length === 0) throw new MetadataPolicyError();
  for (const answer of answers) {
    if (isIP(answer.address) !== answer.family || !isPublicAddress(answer.address)) {
      throw new MetadataPolicyError();
    }
  }

  const selected = answers[0]!;
  return {
    url,
    address: unbracketHostname(selected.address),
    family: selected.family,
  };
}
