import net from "node:net";

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((octets[0]! << 24) >>> 0) + (octets[1]! << 16) + (octets[2]! << 8) + octets[3]!) >>> 0;
}

function inV4Range(value: number, base: string, prefix: number): boolean {
  const start = ipv4ToInt(base)!;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (start & mask);
}

const blockedV4: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["192.175.48.0", 24], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
];

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4ToInt(address);
    return value !== null && !blockedV4.some(([base, prefix]) => inV4Range(value, base, prefix));
  }
  if (family !== 6) return false;
  const normalized = address.toLowerCase().split("%")[0]!;
  const mapped = normalized.match(/^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicAddress(mapped[1]!);
  if (normalized === "::" || normalized === "::1") return false;
  if (/^(fc|fd)/.test(normalized) || /^fe[89ab]/.test(normalized) || /^ff/.test(normalized)) return false;
  if (/^2001:db8(?:[:]|$)/.test(normalized) || /^2001:0*(?:[:]|$)/.test(normalized)) return false;
  if (/^100:(?:0*:){0,3}/.test(normalized) || /^64:ff9b:1:/.test(normalized)) return false;
  return true;
}

export function isSpecialUseHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || [".localhost", ".local", ".internal", ".test", ".invalid", ".example"].some((suffix) => host.endsWith(suffix));
}
