import { BlockList, isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';
import { canonicalizeUrl } from '../../shared/normalization/index.js';

export type ResolvedAddress = { address: string; family: 4|6 };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;
export class UrlPolicyError extends Error { constructor(public code: string, message: string) { super(message); } }

const blocked = new BlockList();
for (const [network, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as Array<[string,number]>) blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::',128],['::1',128],['64:ff9b::',96],['100::',64],['2001:db8::',32],['fc00::',7],['fe80::',10],['ff00::',8]] as Array<[string,number]>) blocked.addSubnet(network, prefix, 'ipv6');

const specialHosts = ['localhost', 'localhost.localdomain', 'local', 'home.arpa', 'invalid', 'test', 'example'];
export function isSpecialHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return specialHosts.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export const systemResolver: Resolver = async (hostname) => {
  const [v4, v6] = await Promise.all([resolve4(hostname).catch(() => []), resolve6(hostname).catch(() => [])]);
  return [...v4.map((address):ResolvedAddress => ({ address, family: 4 })), ...v6.map((address):ResolvedAddress => ({ address, family: 6 }))];
};

export async function validatePublicUrl(input: string, resolver: Resolver = systemResolver): Promise<{url: URL; normalizedUrl: string; addresses: ResolvedAddress[]}> {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new UrlPolicyError('invalid_url', 'Enter a complete web address.'); }
  if (!['http:','https:'].includes(url.protocol)) throw new UrlPolicyError('unsupported_scheme', 'Only HTTP and HTTPS web addresses are supported.');
  if (url.username || url.password) throw new UrlPolicyError('credentials_not_allowed', 'Web addresses containing credentials are not allowed.');
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) throw new UrlPolicyError('port_not_allowed', 'Only standard web ports are allowed.');
  if (!url.hostname || isIP(url.hostname.replace(/^\[|\]$/g, '')) || isSpecialHostname(url.hostname)) throw new UrlPolicyError('unsafe_destination', 'That destination is not a public webpage.');
  let addresses: ResolvedAddress[];
  try { addresses = await resolver(url.hostname); } catch { throw new UrlPolicyError('dns_failure', 'The destination could not be reached.'); }
  if (!addresses.length) throw new UrlPolicyError('dns_failure', 'The destination could not be reached.');
  if (addresses.some(({address}) => !isPublicAddress(address))) throw new UrlPolicyError('unsafe_destination', 'That destination is not a public webpage.');
  const normalizedUrl = canonicalizeUrl(url.toString());
  return { url: new URL(normalizedUrl), normalizedUrl, addresses };
}
