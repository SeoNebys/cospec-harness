import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import {
  isPublicAddress,
  normalizeAddress,
  resolvePublicAddresses,
  type AddressResolver,
  type ResolvedAddress,
} from "./address-policy.server";

const MAX_BODY = 512 * 1024;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export type FetchPageOptions = {
  resolver?: AddressResolver;
  allowAddress?: (address: string) => boolean;
  allowTestPorts?: boolean;
  deadlineMs?: number;
};

export type FetchedPage = { body: Buffer; contentType: string; finalUrl: string };

function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return ((_hostname: string, options: any, callback: any) => {
    if (typeof options === "object" && options.all) {
      callback(null, addresses);
      return;
    }
    const first = addresses[0];
    callback(null, first?.address, first?.family);
  }) as LookupFunction;
}

function resolveLocation(current: URL, location: string) {
  try { return new URL(location, current); }
  catch { throw new Error("unreachable"); }
}

export async function fetchPage(url: URL, options: FetchPageOptions = {}): Promise<FetchedPage> {
  const started = Date.now();
  const visited = new Set<string>();
  const deadlineMs = options.deadlineMs ?? 2500;

  async function hop(current: URL, redirectCount: number): Promise<FetchedPage> {
    if (current.protocol !== "http:" && current.protocol !== "https:") throw new Error("blocked");
    if (current.username || current.password) throw new Error("blocked");
    const port = current.port || (current.protocol === "https:" ? "443" : "80");
    if (!options.allowTestPorts && port !== "80" && port !== "443") throw new Error("blocked");
    if (visited.has(current.toString()) || redirectCount > 3) throw new Error("unreachable");
    visited.add(current.toString());

    const rawAddresses = options.resolver
      ? await options.resolver(current.hostname.replace(/^\[|\]$/g, ""))
      : await resolvePublicAddresses(current.hostname);
    const allow = options.allowAddress ?? isPublicAddress;
    if (!rawAddresses.length || rawAddresses.some(({ address }) => !allow(address))) throw new Error("blocked");
    const addresses = rawAddresses.map((entry) => ({ ...entry, address: normalizeAddress(entry.address) }));
    const remaining = deadlineMs - (Date.now() - started);
    if (remaining <= 0) throw new Error("timeout");

    return new Promise<FetchedPage>((resolve, reject) => {
      const transport = current.protocol === "https:" ? https : http;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("timeout")), remaining);
      timer.unref();
      const request = transport.request(current, {
        method: "GET",
        agent: false,
        lookup: pinnedLookup(addresses),
        signal: controller.signal,
        maxHeaderSize: 16 * 1024,
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9",
          "accept-encoding": "identity",
          "user-agent": "KeepsakeMetadata/1.0",
        },
      }, (response) => {
        if (response.rawHeaders.length / 2 > 100) {
          response.destroy();
          reject(new Error("unreachable"));
          return;
        }
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (REDIRECTS.has(status) && location) {
          response.resume();
          const next = resolveLocation(current, location);
          if (current.protocol === "https:" && next.protocol === "http:") {
            clearTimeout(timer);
            reject(new Error("blocked"));
            return;
          }
          clearTimeout(timer);
          void hop(next, redirectCount + 1).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          clearTimeout(timer);
          reject(new Error("unreachable"));
          return;
        }
        const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
          response.resume();
          clearTimeout(timer);
          reject(new Error("non_html"));
          return;
        }
        const encoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
        if (encoding !== "identity") {
          response.resume();
          clearTimeout(timer);
          reject(new Error("non_html"));
          return;
        }
        const declaredLength = Number(response.headers["content-length"] ?? 0);
        if (declaredLength > MAX_BODY) {
          response.destroy();
          clearTimeout(timer);
          reject(new Error("unreachable"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY) response.destroy(new Error("unreachable"));
          else chunks.push(Buffer.from(chunk));
        });
        response.on("end", () => {
          clearTimeout(timer);
          resolve({ body: Buffer.concat(chunks), contentType, finalUrl: current.toString() });
        });
        response.on("error", (error) => {
          clearTimeout(timer);
          reject(error.message === "unreachable" ? error : new Error("unreachable"));
        });
      });

      request.setTimeout(750, () => request.destroy(new Error("timeout")));
      request.on("socket", (socket) => {
        const verifyPeer = () => {
          const peer = normalizeAddress(socket.remoteAddress ?? "");
          if (!addresses.some(({ address }) => normalizeAddress(address) === peer)) request.destroy(new Error("blocked"));
        };
        socket.once(current.protocol === "https:" ? "secureConnect" : "connect", verifyPeer);
      });
      request.on("error", (error) => {
        clearTimeout(timer);
        if (controller.signal.aborted) reject(new Error("timeout"));
        else if (["blocked", "timeout", "non_html", "unreachable"].includes(error.message)) reject(error);
        else reject(new Error("unreachable"));
      });
      request.end();
    });
  }

  return hop(url, 0);
}
