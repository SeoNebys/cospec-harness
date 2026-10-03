import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { Agent } from "undici";

export class MetadataNetworkError extends Error {
  readonly code: string;
  constructor(code = "METADATA_UNAVAILABLE") {
    super("Page metadata is unavailable.");
    this.name = "MetadataNetworkError";
    this.code = code;
  }
}

export interface ResolvedTarget {
  hostname: string;
  addresses: ReadonlyArray<{ address: string; family: 4 | 6 }>;
}

export type Resolver = (hostname: string) => Promise<ReadonlyArray<{ address: string; family: number }>>;

const ipv4Blocks: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const ipv6Blocks: Array<[string, number]> = [
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 23], ["2001:db8::", 32], ["2001:10::", 28], ["2002::", 16], ["fc00::", 7],
  ["fe80::", 10], ["ff00::", 8],
];

// Keep families separate: Node represents IPv4 internally as mapped IPv6 in a
// mixed BlockList, which would make the explicit ::ffff:0:0/96 rule match every
// otherwise-public IPv4 address.
const blocked4 = new net.BlockList();
const blocked6 = new net.BlockList();
for (const [address, prefix] of ipv4Blocks) blocked4.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of ipv6Blocks) blocked6.addSubnet(address, prefix, "ipv6");

export function isGloballyRoutable(address: string): boolean {
  const family = net.isIP(address);
  if (!family) return false;
  return family === 4 ? !blocked4.check(address, "ipv4") : !blocked6.check(address, "ipv6");
}

export function validateMetadataUrl(input: string | URL): URL {
  let url: URL;
  try { url = input instanceof URL ? new URL(input.href) : new URL(input); }
  catch { throw new MetadataNetworkError("INVALID_URL"); }
  if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) {
    throw new MetadataNetworkError("URL_NOT_ALLOWED");
  }
  const expectedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== expectedPort) throw new MetadataNetworkError("URL_NOT_ALLOWED");
  return url;
}

const defaultResolver: Resolver = (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

export async function resolvePublicTarget(urlInput: string | URL, resolver: Resolver = defaultResolver): Promise<ResolvedTarget> {
  const url = validateMetadataUrl(urlInput);
  const hostname = url.hostname.startsWith("[") && url.hostname.endsWith("]") ? url.hostname.slice(1, -1) : url.hostname;
  let answers: ReadonlyArray<{ address: string; family: number }>;
  if (net.isIP(hostname)) answers = [{ address: hostname, family: net.isIP(hostname) }];
  else {
    try { answers = await resolver(hostname); }
    catch { throw new MetadataNetworkError(); }
  }
  if (!answers.length || answers.some((answer) => !isGloballyRoutable(answer.address) || (answer.family !== 4 && answer.family !== 6))) {
    throw new MetadataNetworkError("ADDRESS_NOT_ALLOWED");
  }
  return { hostname, addresses: answers as ResolvedTarget["addresses"] };
}

export function createPinnedDispatcher(url: URL, target: ResolvedTarget): Agent {
  let nextAddress = 0;
  return new Agent({
    connect(options, callback) {
      const selected = target.addresses[nextAddress++ % target.addresses.length]!;
      const port = Number(options.port || (url.protocol === "https:" ? 443 : 80));
      const onConnect = () => {
        const peer = socket.remoteAddress;
        if (!peer || !isGloballyRoutable(peer) || !target.addresses.some((item) => item.address === peer)) {
          socket.destroy();
          callback(new MetadataNetworkError("PEER_MISMATCH"), null);
          return;
        }
        callback(null, socket);
      };
      const socket = url.protocol === "https:"
        ? tls.connect({ host: selected.address, port, servername: target.hostname, rejectUnauthorized: true }, onConnect)
        : net.connect({ host: selected.address, port }, onConnect);
      socket.once("error", (error) => callback(error, null));
      return socket;
    },
  });
}

export function sanitizeMetadataError(error: unknown): MetadataNetworkError {
  void error;
  return new MetadataNetworkError();
}
