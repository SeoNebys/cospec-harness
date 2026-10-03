import { promises as dns } from "node:dns";
import * as http from "node:http";
import * as https from "node:https";
import type { LookupFunction } from "node:net";
import { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

import { classifyIpAddress, type ResolvedAddress, validatePublicAddresses } from "./ip-policy.js";

export const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"] as const;
export const RASTER_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
] as const;

export type SafeMetadataFetchErrorCode =
  | "UNSUPPORTED_PROTOCOL"
  | "DENIED_DESTINATION"
  | "DNS_FAILURE"
  | "TIMEOUT"
  | "TOO_MANY_REDIRECTS"
  | "INVALID_REDIRECT"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "TOO_LARGE"
  | "UNAVAILABLE";

export class SafeMetadataFetchError extends Error {
  readonly code: SafeMetadataFetchErrorCode;

  constructor(code: SafeMetadataFetchErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SafeMetadataFetchError";
    this.code = code;
  }
}

export interface DnsResolver {
  resolve(hostname: string, signal: AbortSignal): Promise<readonly ResolvedAddress[]>;
}

export interface SafeTransportRequest {
  url: URL;
  addresses: readonly ResolvedAddress[];
  signal: AbortSignal;
  connectTimeoutMs: number;
  headers: Readonly<Record<string, string>>;
}

export interface SafeTransportResponse {
  statusCode: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  body: AsyncIterable<Uint8Array>;
}

export interface SafeFetchTransport {
  request(request: SafeTransportRequest): Promise<SafeTransportResponse>;
}

export interface SafeFetchOptions {
  resolver?: DnsResolver;
  transport?: SafeFetchTransport;
  deadlineMs?: number;
  connectTimeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  acceptedContentTypes?: readonly string[];
  headers?: Readonly<Record<string, string>>;
}

export interface SafeFetchResult {
  finalUrl: URL;
  statusCode: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  contentType: string;
  body: Buffer;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const defaultResolver: DnsResolver = {
  async resolve(hostname) {
    const answers = await dns.lookup(hostname, { all: true, verbatim: true });
    return answers.map(({ address, family }) => ({
      address,
      family: family === 6 ? 6 : 4,
    }));
  },
};

function headerValue(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return typeof value === "string" ? value : value?.[0];
}

function publicLiteralAddress(hostname: string): ResolvedAddress | undefined {
  const candidate =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  const classification = classifyIpAddress(candidate);
  if (classification === "invalid") return undefined;
  if (classification !== "public") {
    throw new SafeMetadataFetchError(
      "DENIED_DESTINATION",
      "Metadata retrieval is not allowed for this destination",
    );
  }
  return { address: candidate, family: candidate.includes(":") ? 6 : 4 };
}

function validateUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeMetadataFetchError(
      "UNSUPPORTED_PROTOCOL",
      "Metadata retrieval supports only HTTP and HTTPS addresses",
    );
  }
  if (url.username || url.password) {
    throw new SafeMetadataFetchError(
      "DENIED_DESTINATION",
      "Metadata retrieval does not allow destination credentials",
    );
  }
  if (url.port !== "") {
    throw new SafeMetadataFetchError(
      "DENIED_DESTINATION",
      "Metadata retrieval does not allow custom destination ports",
    );
  }
}

function timeoutError(): SafeMetadataFetchError {
  return new SafeMetadataFetchError("TIMEOUT", "Metadata retrieval timed out");
}

async function withinDeadline<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw timeoutError();

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(timeoutError());
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function normalizeTransportHeaders(
  headers: http.IncomingHttpHeaders,
): Readonly<Record<string, string | readonly string[] | undefined>> {
  return headers;
}

export const nodeSafeFetchTransport: SafeFetchTransport = {
  request(request) {
    return new Promise((resolve, reject) => {
      const selected = request.addresses[0];
      if (!selected) {
        reject(new SafeMetadataFetchError("DNS_FAILURE", "Destination did not resolve"));
        return;
      }

      const lookup: LookupFunction = (_hostname, lookupOptions, callback) => {
        if (lookupOptions.all) {
          callback(
            null,
            request.addresses.map(({ address, family }) => ({ address, family })),
          );
          return;
        }
        const requestedFamily = lookupOptions.family;
        const answer =
          requestedFamily === 4 || requestedFamily === 6
            ? (request.addresses.find(({ family }) => family === requestedFamily) ?? selected)
            : selected;
        callback(null, answer.address, answer.family);
      };
      const client = request.url.protocol === "https:" ? https : http;
      const outgoing = client.request(
        request.url,
        {
          method: "GET",
          headers: request.headers,
          lookup,
          signal: request.signal,
          timeout: request.connectTimeoutMs,
          agent: false,
        },
        (incoming) => {
          resolve({
            statusCode: incoming.statusCode ?? 0,
            headers: normalizeTransportHeaders(incoming.headers),
            body: incoming,
          });
        },
      );

      outgoing.once("timeout", () => {
        outgoing.destroy(timeoutError());
      });
      outgoing.once("error", reject);
      outgoing.end();
    });
  },
};

async function resolveAndValidate(
  url: URL,
  resolver: DnsResolver,
  signal: AbortSignal,
): Promise<readonly ResolvedAddress[]> {
  const literal = publicLiteralAddress(url.hostname);
  if (literal) return [literal];

  let addresses: readonly ResolvedAddress[];
  try {
    addresses = await withinDeadline(resolver.resolve(url.hostname, signal), signal);
  } catch (error) {
    if (error instanceof SafeMetadataFetchError) throw error;
    throw new SafeMetadataFetchError("DNS_FAILURE", "Destination could not be resolved", {
      cause: error,
    });
  }

  try {
    return validatePublicAddresses(addresses);
  } catch (error) {
    throw new SafeMetadataFetchError(
      "DENIED_DESTINATION",
      "Metadata retrieval is not allowed for this destination",
      { cause: error },
    );
  }
}

function decodedBody(
  body: AsyncIterable<Uint8Array>,
  contentEncoding: string | undefined,
): AsyncIterable<Uint8Array> {
  const source = Readable.from(body);
  const encoding = contentEncoding?.trim().toLowerCase();
  switch (encoding) {
    case undefined:
    case "":
    case "identity":
      return source;
    case "gzip":
    case "x-gzip":
      return source.pipe(createGunzip());
    case "deflate":
      return source.pipe(createInflate());
    case "br":
      return source.pipe(createBrotliDecompress());
    default:
      throw new SafeMetadataFetchError(
        "UNAVAILABLE",
        "The destination used an unsupported content encoding",
      );
  }
}

async function readBoundedBody(
  response: SafeTransportResponse,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Buffer> {
  const contentLength = Number(headerValue(response.headers, "content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new SafeMetadataFetchError("TOO_LARGE", "Metadata response was too large");
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    for await (const value of decodedBody(
      response.body,
      headerValue(response.headers, "content-encoding"),
    )) {
      if (signal.aborted) throw timeoutError();
      const chunk = Buffer.from(value);
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        throw new SafeMetadataFetchError("TOO_LARGE", "Metadata response was too large");
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof SafeMetadataFetchError) throw error;
    if (signal.aborted) throw timeoutError();
    throw new SafeMetadataFetchError("UNAVAILABLE", "Metadata response could not be read", {
      cause: error,
    });
  }
  return Buffer.concat(chunks, bytes);
}

function contentTypeOf(response: SafeTransportResponse): string {
  return (
    (headerValue(response.headers, "content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase() ??
    ""
  );
}

export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  let current: URL;
  try {
    current = input instanceof URL ? new URL(input) : new URL(input);
  } catch (error) {
    throw new SafeMetadataFetchError("DENIED_DESTINATION", "Destination address is invalid", {
      cause: error,
    });
  }
  validateUrl(current);

  const resolver = options.resolver ?? defaultResolver;
  const transport = options.transport ?? nodeSafeFetchTransport;
  const maxRedirects = options.maxRedirects ?? 5;
  const maxBytes = options.maxBytes ?? 1_048_576;
  const deadlineMs = options.deadlineMs ?? 5_000;
  const connectTimeoutMs = Math.min(options.connectTimeoutMs ?? 2_000, deadlineMs);
  const acceptedContentTypes = new Set(options.acceptedContentTypes ?? HTML_CONTENT_TYPES);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deadlineMs);

  try {
    for (let redirects = 0; ; redirects += 1) {
      validateUrl(current);
      const addresses = await resolveAndValidate(current, resolver, controller.signal);
      let response: SafeTransportResponse;
      try {
        response = await withinDeadline(
          transport.request({
            url: new URL(current),
            addresses,
            signal: controller.signal,
            connectTimeoutMs,
            headers: {
              accept: [...acceptedContentTypes].join(", "),
              "accept-encoding": "gzip, deflate, br",
              "user-agent": "BookmarkGardenMetadata/1.0",
              ...options.headers,
            },
          }),
          controller.signal,
        );
      } catch (error) {
        if (error instanceof SafeMetadataFetchError) throw error;
        if (controller.signal.aborted) throw timeoutError();
        throw new SafeMetadataFetchError("UNAVAILABLE", "Destination could not be reached", {
          cause: error,
        });
      }

      if (REDIRECT_STATUSES.has(response.statusCode)) {
        if (redirects >= maxRedirects) {
          throw new SafeMetadataFetchError(
            "TOO_MANY_REDIRECTS",
            "Destination redirected too many times",
          );
        }
        const location = headerValue(response.headers, "location");
        if (!location) {
          throw new SafeMetadataFetchError(
            "INVALID_REDIRECT",
            "Redirect did not include a location",
          );
        }
        try {
          current = new URL(location, current);
        } catch (error) {
          throw new SafeMetadataFetchError("INVALID_REDIRECT", "Redirect location was invalid", {
            cause: error,
          });
        }
        continue;
      }

      const contentType = contentTypeOf(response);
      if (!acceptedContentTypes.has(contentType)) {
        throw new SafeMetadataFetchError(
          "UNSUPPORTED_CONTENT_TYPE",
          "Destination returned an unsupported content type",
        );
      }

      const body = await withinDeadline(
        readBoundedBody(response, maxBytes, controller.signal),
        controller.signal,
      );
      return {
        finalUrl: new URL(current),
        statusCode: response.statusCode,
        headers: response.headers,
        contentType,
        body,
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchHtml(
  input: string | URL,
  options: Omit<SafeFetchOptions, "acceptedContentTypes"> = {},
): Promise<SafeFetchResult> {
  return safeFetch(input, { ...options, acceptedContentTypes: HTML_CONTENT_TYPES });
}

export function fetchRasterImage(
  input: string | URL,
  options: Omit<SafeFetchOptions, "acceptedContentTypes"> = {},
): Promise<SafeFetchResult> {
  return safeFetch(input, {
    ...options,
    maxBytes: options.maxBytes ?? 262_144,
    acceptedContentTypes: RASTER_IMAGE_CONTENT_TYPES,
  });
}
