import { isIP } from 'node:net';

function ipv4Number(ip: string): number { return ip.split('.').reduce((n, part) => (n << 8) + Number(part), 0) >>> 0; }
function inV4(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(ip) & mask) === (ipv4Number(base) & mask);
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const denied: Array<[string, number]> = [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]];
    return !denied.some(([base, bits]) => inV4(address, base, bits));
  }
  if (family === 6) {
    const ip = address.toLowerCase();
    if (ip === '::' || ip === '::1' || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('ff')) return false;
    if (ip.startsWith('2001:db8:')) return false;
    if (ip.startsWith('::ffff:')) return isPublicAddress(ip.slice(7));
    return true;
  }
  return false;
}

export function allowedFetchHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  return Boolean(lower) && !isIP(lower) && lower !== 'localhost' && !lower.endsWith('.localhost') && !lower.endsWith('.local');
}
