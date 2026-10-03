import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { isPublicAddress, isSpecialUseHostname } from "./ip-policy.js";

export class MetadataFetchError extends Error {
  constructor(public readonly code: "blocked" | "timeout" | "network" | "too_large" | "unsupported" | "redirect") {
    super(code);
  }
}

export type SafeResponse = { body: Buffer; contentType: string; finalUrl: string };

export class SafeHttpClient {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  constructor(private readonly maxConcurrent = 6) {}

  async fetchHtml(url: URL): Promise<SafeResponse> {
    return this.withSlot(() => this.fetch(url, 1_048_576, true));
  }

  async fetchIcon(url: URL): Promise<SafeResponse> {
    return this.withSlot(() => this.fetch(url, 262_144, false));
  }

  private async withSlot<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try { return await work(); }
    finally { this.active--; this.waiting.shift()?.(); }
  }

  private async fetch(initial: URL, limit: number, htmlOnly: boolean): Promise<SafeResponse> {
    const deadline = Date.now() + 4_500;
    let current = new URL(initial);
    const visited = new Set<string>();
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (visited.has(current.toString())) throw new MetadataFetchError("redirect");
      visited.add(current.toString());
      this.validateUrl(current);
      const result = await this.requestOnce(current, limit, deadline);
      if (result.status >= 300 && result.status < 400 && result.location) {
        if (redirects === 5) throw new MetadataFetchError("redirect");
        const next = new URL(result.location, current);
        if (current.protocol === "https:" && next.protocol === "http:") throw new MetadataFetchError("redirect");
        current = next;
        continue;
      }
      if (result.status < 200 || result.status >= 300) throw new MetadataFetchError("network");
      const contentType = result.contentType.split(";", 1)[0]!.trim().toLowerCase();
      if (htmlOnly && !["text/html", "application/xhtml+xml"].includes(contentType)) {
        throw new MetadataFetchError("unsupported");
      }
      return { body: result.body, contentType, finalUrl: current.toString() };
    }
    throw new MetadataFetchError("redirect");
  }

  private validateUrl(url: URL): void {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new MetadataFetchError("blocked");
    const validPort = url.port === "" || (url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443");
    if (!validPort || isSpecialUseHostname(url.hostname)) throw new MetadataFetchError("blocked");
  }

  private async resolve(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
    const literal = hostname.replace(/^\[|\]$/g, "");
    const family = net.isIP(literal);
    const answers = family ? [{ address: literal, family: family as 4 | 6 }] : await dns.lookup(hostname, { all: true, verbatim: true });
    if (!answers.length || answers.some((answer) => !isPublicAddress(answer.address))) throw new MetadataFetchError("blocked");
    return answers[0] as { address: string; family: 4 | 6 };
  }

  private async requestOnce(url: URL, limit: number, deadline: number): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
    const pinned = await this.resolve(url.hostname);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new MetadataFetchError("timeout");
    return await new Promise((resolve, reject) => {
      const transport = url.protocol === "https:" ? https : http;
      const request = transport.request(url, {
        method: "GET",
        headers: {
          Accept: limit > 262_144 ? "text/html,application/xhtml+xml" : "image/png,image/jpeg,image/gif,image/webp,image/x-icon",
          "Accept-Encoding": "identity",
          "User-Agent": "Keep-Metadata/1.0",
          Connection: "close"
        },
        maxHeaderSize: 16_384,
        lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
        servername: url.hostname,
        rejectUnauthorized: true,
        agent: false
      }, (response) => {
        const peer = response.socket.remoteAddress?.replace(/^::ffff:/, "");
        const expected = pinned.address.replace(/^::ffff:/, "");
        if (!peer || peer !== expected || !isPublicAddress(peer)) {
          response.destroy(); reject(new MetadataFetchError("blocked")); return;
        }
        const encoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
        if (encoding !== "identity") {
          response.destroy(); reject(new MetadataFetchError("unsupported")); return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit) {
            response.destroy(new MetadataFetchError("too_large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({
          status: response.statusCode ?? 0,
          ...(response.headers.location ? { location: response.headers.location } : {}),
          contentType: String(response.headers["content-type"] ?? ""),
          body: Buffer.concat(chunks)
        }));
        response.on("error", reject);
      });
      request.setTimeout(remaining, () => request.destroy(new MetadataFetchError("timeout")));
      request.on("error", (error) => reject(error instanceof MetadataFetchError ? error : new MetadataFetchError("network")));
      request.end();
    });
  }
}
