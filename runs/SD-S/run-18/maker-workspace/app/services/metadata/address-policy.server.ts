import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(network, prefix, "ipv4");

for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64],
  ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(network, prefix, "ipv6");

export function normalizeAddress(address: string) {
  const clean = address.replace(/^\[|\]$/g, "").split("%", 1)[0] ?? address;
  const mapped = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped?.[1]) return mapped[1];
  const mappedHex = clean.match(/^::ffff:([a-f\d]{1,4}):([a-f\d]{1,4})$/i);
  if (mappedHex?.[1] && mappedHex[2]) {
    const value = (Number.parseInt(mappedHex[1], 16) << 16) + Number.parseInt(mappedHex[2], 16);
    return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
  }
  return clean;
}

export function isPublicAddress(address: string) {
  const normalized = normalizeAddress(address);
  const family = isIP(normalized);
  if (family === 4) return !blocked.check(normalized, "ipv4");
  if (family === 6) return !blocked.check(normalized, "ipv6");
  return false;
}

export const systemResolver: AddressResolver = async (hostname) => {
  const records = await dnsLookup(hostname.replace(/^\[|\]$/g, ""), { all: true, verbatim: true });
  return records.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
};

export async function resolvePublicAddresses(hostname: string, resolver: AddressResolver = systemResolver) {
  const timeout = new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 400);
    timer.unref();
  });
  const addresses = await Promise.race([resolver(hostname.replace(/^\[|\]$/g, "")), timeout]);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("blocked");
  }
  return addresses.map((entry) => ({ ...entry, address: normalizeAddress(entry.address) }));
}
