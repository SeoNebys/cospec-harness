import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const blockedNames = new Set(['localhost', 'localhost.localdomain', 'local', 'broadcasthost', 'ip6-localhost', 'ip6-loopback']);

function ipv4Number(address: string): number | null {
  const pieces = address.split('.').map(Number);
  if (pieces.length !== 4 || pieces.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((pieces[0]! * 256 + pieces[1]!) * 256 + pieces[2]!) * 256 + pieces[3]!) >>> 0;
}
const cidr = (address: number, base: string, bits: number) => {
  const baseNumber = ipv4Number(base)!; const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (address & mask) === (baseNumber & mask);
};

export function isPublicAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
  if (mapped) return isPublicAddress(mapped);
  if (isIP(address) === 4) {
    const n = ipv4Number(address)!;
    return ![
      ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],
      ['192.0.0.0',24],['192.0.2.0',24],['192.31.196.0',24],['192.52.193.0',24],['192.88.99.0',24],['192.168.0.0',16],['192.175.48.0',24],
      ['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4],
    ].some(([base,bits]) => cidr(n, base as string, bits as number));
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    return !(lower === '::' || lower === '::1' || lower.startsWith('100:') || lower.startsWith('2001:0') || lower.startsWith('2001:1') || lower.startsWith('2001:2') || lower.startsWith('2001:db8') || lower.startsWith('2002:') || lower.startsWith('fc') || lower.startsWith('fd') || /^fe[89ab]/u.test(lower) || lower.startsWith('ff'));
  }
  return false;
}

export function validateOutboundHostname(hostname: string): void {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu,'').replace(/\.$/u, '');
  if (blockedNames.has(normalized) || ['.localhost','.local','.test','.example','.invalid','.home.arpa'].some(suffix=>normalized.endsWith(suffix)) || normalized === 'home.arpa' || !normalized.includes('.') && !isIP(normalized)) throw new Error('This host is not available for metadata retrieval.');
  if (isIP(normalized) && !isPublicAddress(normalized)) throw new Error('Private and special-use addresses are blocked.');
}

export async function resolvePublic(hostname: string): Promise<Array<{ address: string; family: number }>> {
  validateOutboundHostname(hostname);
  const literal=hostname.replace(/^\[|\]$/gu,'');
  if(isIP(literal)) return [{address:literal,family:isIP(literal)}];
  const answers = await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some((answer) => !isPublicAddress(answer.address))) throw new Error('The host did not resolve to a public address.');
  return answers;
}
