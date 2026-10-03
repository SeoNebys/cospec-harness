import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";
import { request, type Dispatcher } from "undici";
import { createPinnedDispatcher, resolvePublicTarget, sanitizeMetadataError, validateMetadataUrl, type Resolver } from "./network-policy";

export interface FetchLimits { maxCompressedBytes: number; maxDecompressedBytes: number; timeoutMs: number; maxRedirects: number }
export interface FetchResult { finalUrl: string; contentType: string; body: Buffer }
export interface MetadataFetcherOptions {
  resolver?: Resolver;
  limits?: Partial<FetchLimits>;
  dispatcherFactory?: (url: URL, target: Awaited<ReturnType<typeof resolvePublicTarget>>) => Dispatcher;
}

const DEFAULT_LIMITS: FetchLimits = { maxCompressedBytes: 512 * 1024, maxDecompressedBytes: 2 * 1024 * 1024, timeoutMs: 10_000, maxRedirects: 5 };
let active = 0;
const MAX_CONCURRENT = 8;

async function collect(body: AsyncIterable<Uint8Array>, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of body) {
    length += chunk.byteLength;
    if (length > max) throw new Error("limit");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function decode(body: Buffer, encoding: string | undefined, max: number): Buffer {
  let result: Buffer;
  if (!encoding || encoding === "identity") result = body;
  else if (encoding === "gzip" || encoding === "x-gzip") result = gunzipSync(body, { maxOutputLength: max });
  else if (encoding === "deflate") result = inflateSync(body, { maxOutputLength: max });
  else if (encoding === "br") result = brotliDecompressSync(body, { maxOutputLength: max });
  else throw new Error("encoding");
  if (result.length > max) throw new Error("limit");
  return result;
}

export async function fetchBounded(urlInput: string | URL, options: MetadataFetcherOptions = {}, kind: "html" | "icon" = "html"): Promise<FetchResult> {
  if (active >= MAX_CONCURRENT) throw sanitizeMetadataError(null);
  active++;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  let dispatcher: Dispatcher | undefined;
  let ownsDispatcher = false;
  try {
    let url = validateMetadataUrl(urlInput);
    for (let redirect = 0; ; redirect++) {
      const target = await resolvePublicTarget(url, options.resolver);
      dispatcher = options.dispatcherFactory?.(url, target) ?? createPinnedDispatcher(url, target);
      ownsDispatcher = !options.dispatcherFactory;
      const response = await request(url, {
        dispatcher, signal: controller.signal,
        headers: { accept: kind === "html" ? "text/html,application/xhtml+xml" : "image/png,image/jpeg,image/gif,image/webp,image/x-icon", "user-agent": "BookmarkManagerMetadata/1.0" },
        headersTimeout: limits.timeoutMs, bodyTimeout: limits.timeoutMs,
      });
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        await response.body.dump();
        if (redirect >= limits.maxRedirects) throw new Error("redirect");
        const location = response.headers.location;
        if (!location) throw new Error("redirect");
        url = validateMetadataUrl(new URL(Array.isArray(location) ? location[0]! : location, url));
        if (ownsDispatcher) await dispatcher.close();
        dispatcher = undefined;
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) throw new Error("status");
      const contentType = String(response.headers["content-type"] ?? "").split(";", 1)[0]!.trim().toLowerCase();
      if (kind === "html" && contentType !== "text/html" && contentType !== "application/xhtml+xml") throw new Error("content-type");
      const compressed = await collect(response.body, limits.maxCompressedBytes);
      const body = decode(compressed, String(response.headers["content-encoding"] ?? "").toLowerCase(), limits.maxDecompressedBytes);
      return { finalUrl: url.href, contentType, body };
    }
  } catch (error) {
    throw sanitizeMetadataError(error);
  } finally {
    clearTimeout(timer); active--;
    if (dispatcher && ownsDispatcher) await dispatcher.close().catch(() => undefined);
  }
}

export function fetchHtml(url: string | URL, options?: MetadataFetcherOptions): Promise<FetchResult> {
  return fetchBounded(url, options, "html");
}
