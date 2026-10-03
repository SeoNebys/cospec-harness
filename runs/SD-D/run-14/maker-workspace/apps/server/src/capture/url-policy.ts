import dns from 'node:dns/promises';
import net from 'node:net';

function blockedV4(ip: string): boolean {
  const n = ip.split('.').map(Number); const [a,b] = n;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168) || (a === 100 && b! >= 64 && b! <= 127) || a! >= 224;
}
function blockedV6(ip: string): boolean {
  const s = ip.toLowerCase(); return s === '::' || s === '::1' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb') || s.startsWith('ff') || s.startsWith('::ffff:127.') || s.startsWith('::ffff:10.') || s.startsWith('::ffff:192.168.');
}
export function normalizeUrl(input: string): string {
  const raw = input.trim(); const value = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(value); if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP(S) addresses are supported');
  url.hash = ''; url.hostname = url.hostname.toLowerCase(); if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  if (url.toString().length > 4096) throw new Error('Address is too long'); return url.toString();
}
export async function assertPublicUrl(input: string, allowPrivate = false): Promise<string> {
  const normalized = normalizeUrl(input); if (allowPrivate) return normalized;
  const { hostname } = new URL(normalized); if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('Private addresses cannot be captured');
  const direct = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!direct.length || direct.some(x => x.family === 4 ? blockedV4(x.address) : blockedV6(x.address))) throw new Error('Private or reserved addresses cannot be captured');
  return normalized;
}
