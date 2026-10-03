import dns from 'node:dns/promises';
import net from 'node:net';
import { UrlPolicyError } from './url-policy.js';

function ipv4Number(ip: string): number {
  return ip.split('.').reduce((n, part) => ((n << 8) | Number(part)) >>> 0, 0);
}

function inV4(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(ip) & mask) === (ipv4Number(base) & mask);
}

export function isGloballyReachable(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    return ![
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
      ['224.0.0.0', 4], ['240.0.0.0', 4],
    ].some(([base, bits]) => inV4(address, String(base), Number(bits)));
  }
  if (family === 6) {
    const ip = address.toLowerCase();
    if (ip.startsWith('::ffff:')) return isGloballyReachable(ip.slice(7));
    return !(ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || /^fe[89ab]/u.test(ip) || ip.startsWith('ff') || ip.startsWith('2001:db8:'));
  }
  return false;
}

export type ResolveHost = typeof dns.lookup;

export async function assertPublicHost(hostname: string, lookup: ResolveHost = dns.lookup): Promise<void> {
  const literal = net.isIP(hostname);
  const answers = literal ? [{ address: hostname, family: literal }] : await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some(({ address }) => !isGloballyReachable(address))) {
    throw new UrlPolicyError('NON_PUBLIC_DESTINATION', 'That address does not point to a public internet destination.');
  }
}
