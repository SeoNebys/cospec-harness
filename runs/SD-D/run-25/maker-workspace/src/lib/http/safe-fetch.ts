import "server-only";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import ipaddr from "ipaddr.js";

export class SafeFetchError extends Error {
  constructor(
    public readonly code: "blocked" | "timeout" | "redirect" | "too_large" | "content_type" | "network",
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export type SafeFetchOptions = {
  maxBytes: number;
  timeoutMs: number;
  allowedContentTypes: RegExp;
  maxRedirects?: number;
};

export type SafeFetchResult = {
  finalUrl: string;
  contentType: string;
  body: Buffer;
};

function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    const ipv6 = parsed.kind() === "ipv6" ? (parsed as ipaddr.IPv6) : null;
    const normalized = ipv6?.isIPv4MappedAddress() ? ipv6.toIPv4Address() : parsed;
    return normalized.range() === "unicast";
  } catch {
    return false;
  }
}

async function vettedAddress(hostname: string): Promise<{ address: string; family: number }> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => !isPublicAddress(record.address))) {
    throw new SafeFetchError("blocked", "The destination is not a public internet address.");
  }
  return records[0]!;
}

function assertNetworkUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafeFetchError("blocked", "The destination address is invalid.");
  }
  if (!(["http:", "https:"] as const).includes(url.protocol as "http:" | "https:")) {
    throw new SafeFetchError("blocked", "Only HTTP and HTTPS destinations are allowed.");
  }
  if (url.username || url.password) throw new SafeFetchError("blocked", "Destination credentials are not allowed.");
  url.hash = "";
  return url;
}

async function requestOnce(url: URL, options: SafeFetchOptions, deadline: number): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const resolved = await vettedAddress(url.hostname);
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new SafeFetchError("timeout", "The page took too long to respond.");
  const transport = url.protocol === "https:" ? https : http;
  const defaultPort = url.protocol === "https:" ? 443 : 80;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: resolved.address,
        family: resolved.family,
        port: url.port ? Number(url.port) : defaultPort,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        servername: url.hostname,
        headers: {
          host: url.host,
          accept: "text/html,application/xhtml+xml,image/png,image/jpeg,image/gif,image/webp,image/x-icon;q=0.9,*/*;q=0.1",
          "accept-encoding": "gzip, deflate, br",
          "user-agent": "Safekeep-Metadata/1.0 (+bookmark preview)",
        },
        timeout: Math.min(remaining, options.timeoutMs),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
        let stream: NodeJS.ReadableStream = response;
        if (encoding === "gzip") stream = response.pipe(createGunzip());
        else if (encoding === "deflate") stream = response.pipe(createInflate());
        else if (encoding === "br") stream = response.pipe(createBrotliDecompress());

        stream.on("data", (chunk: Buffer | string) => {
          const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += value.length;
          if (size > options.maxBytes) {
            req.destroy(new SafeFetchError("too_large", "The response is larger than the preview limit."));
            return;
          }
          chunks.push(value);
        });
        stream.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }));
        stream.on("error", reject);
      },
    );
    const timer = setTimeout(() => req.destroy(new SafeFetchError("timeout", "The page took too long to respond.")), remaining);
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(new SafeFetchError("timeout", "The page took too long to respond.")));
    req.on("error", (error) => reject(error instanceof SafeFetchError ? error : new SafeFetchError("network", "The page could not be reached.")));
    req.end();
  });
}

export async function safeFetch(input: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const deadline = Date.now() + options.timeoutMs;
  const seen = new Set<string>();
  let current = assertNetworkUrl(input);
  const maxRedirects = options.maxRedirects ?? 5;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (seen.has(current.href)) throw new SafeFetchError("redirect", "The page redirects in a loop.");
    seen.add(current.href);
    const result = await requestOnce(current, options, deadline);
    if ([301, 302, 303, 307, 308].includes(result.status)) {
      const location = result.headers.location;
      if (!location || hop === maxRedirects) throw new SafeFetchError("redirect", "The page redirected too many times.");
      current = assertNetworkUrl(new URL(location, current).toString());
      continue;
    }
    if (result.status < 200 || result.status >= 300) throw new SafeFetchError("network", `The page returned status ${result.status}.`);
    const contentType = String(result.headers["content-type"] ?? "application/octet-stream").split(";", 1)[0]!.trim().toLowerCase();
    if (!options.allowedContentTypes.test(contentType)) throw new SafeFetchError("content_type", "The destination did not return supported content.");
    return { finalUrl: current.toString(), contentType, body: result.body };
  }
  throw new SafeFetchError("redirect", "The page redirected too many times.");
}
