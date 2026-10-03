import { Client, buildConnector, fetch as undiciFetch } from 'undici';
import type { MetadataPreview } from '../../shared/contracts.js';
import { parsePageMetadata } from './metadata-parser.js';
import {
  MetadataPolicyError,
  type MetadataDnsLookup,
  systemMetadataDnsLookup,
  validateMetadataDestination,
} from './metadata-network-policy.js';

export const METADATA_DEADLINE_MS = 4_000;
export const METADATA_MAX_CONCURRENT = 4;
export const METADATA_MAX_REDIRECTS = 3;
export const METADATA_MAX_BODY_BYTES = 512 * 1024;
export const METADATA_MAX_HEADER_BYTES = 32 * 1024;

export interface MetadataTransportRequest {
  url: URL;
  address: string;
  signal?: AbortSignal;
}

export type MetadataTransportRequestFn = (
  request: MetadataTransportRequest,
) => Promise<Response>;

export interface MetadataPreviewOptions {
  signal?: AbortSignal;
}

export interface MetadataServiceOptions {
  dnsLookup?: MetadataDnsLookup;
  transportRequest?: MetadataTransportRequestFn;
}

export class MetadataConcurrencyError extends Error {
  readonly code = 'METADATA_CONCURRENCY_LIMIT';
  readonly status = 429;

  constructor() {
    super('Page information is busy. Enter bookmark details manually or try again.');
    this.name = 'MetadataConcurrencyError';
  }
}

class MetadataRetrievalError extends Error {
  constructor(message = 'Page information is unavailable. Enter the details manually.') {
    super(message);
    this.name = 'MetadataRetrievalError';
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);

function headerSectionSize(headers: Headers): number {
  let total = 0;
  for (const [name, value] of headers) {
    total += Buffer.byteLength(name) + Buffer.byteLength(value) + 4;
  }
  return total;
}

async function readLimitedBody(
  response: Response,
  limit = METADATA_MAX_BODY_BYTES,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (response.body === null) return new Uint8Array();

  const contentEncoding = response.headers
    .get('content-encoding')
    ?.trim()
    .toLowerCase();
  let body: ReadableStream<Uint8Array> = response.body;

  if (contentEncoding !== undefined && contentEncoding !== '' && contentEncoding !== 'identity') {
    const format = contentEncoding === 'x-gzip' ? 'gzip' : contentEncoding;
    if (format !== 'gzip' && format !== 'deflate') {
      await response.body.cancel();
      throw new MetadataRetrievalError();
    }
    body = body.pipeThrough(new DecompressionStream(format));
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abortRead = () => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };
  signal?.addEventListener('abort', abortRead, { once: true });

  try {
    while (true) {
      if (signal?.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      if (signal?.aborted) throw signal.reason;
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new MetadataRetrievalError();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof MetadataRetrievalError) throw error;
    throw new MetadataRetrievalError();
  } finally {
    signal?.removeEventListener('abort', abortRead);
  }

  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/**
 * Production transport with a one-request Undici client whose connector is
 * pinned to the address that passed policy validation. TLS SNI and HTTP Host
 * still use the original hostname.
 */
export const pinnedUndiciTransport: MetadataTransportRequestFn = async ({
  url,
  address,
  signal,
}) => {
  const connector = buildConnector({ timeout: METADATA_DEADLINE_MS });
  const client = new Client(url.origin, {
    connect: (options, callback) => {
      connector(
        {
          ...options,
          host: address,
          hostname: address,
          servername: url.hostname,
        },
        callback,
      );
    },
    maxHeaderSize: METADATA_MAX_HEADER_BYTES,
    headersTimeout: METADATA_DEADLINE_MS,
    bodyTimeout: METADATA_DEADLINE_MS,
    pipelining: 1,
  });

  try {
    const upstream = await undiciFetch(url, {
      dispatcher: client,
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: {
        accept: 'text/html, application/xhtml+xml;q=0.9',
        'user-agent': 'PersonalBookmarkManager/1.0',
      },
    });

    const bytes = await readLimitedBody(
      upstream as unknown as Response,
      METADATA_MAX_BODY_BYTES,
      signal,
    );
    const headers = new Headers();
    upstream.headers.forEach((value, name) => headers.append(name, value));
    // Undici fetch decodes supported content encodings. Do not ask the service
    // boundary to decode the already-expanded bytes a second time.
    headers.delete('content-encoding');
    headers.delete('content-length');

    return new Response(bytes, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } finally {
    await client.close();
  }
};

function unavailable(requestedUrl: string): MetadataPreview {
  return {
    requestedUrl,
    finalUrl: null,
    outcome: 'unavailable',
    title: null,
    description: null,
    message: 'Page information is unavailable. Enter the details manually.',
  };
}

function throwIfCallerAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }
}

function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

export function createMetadataService(options: MetadataServiceOptions = {}) {
  const dnsLookup = options.dnsLookup ?? systemMetadataDnsLookup;
  const transportRequest = options.transportRequest ?? pinnedUndiciTransport;
  let activeRequests = 0;

  return {
    async preview(
      input: string,
      requestOptions: MetadataPreviewOptions = {},
    ): Promise<MetadataPreview> {
      if (activeRequests >= METADATA_MAX_CONCURRENT) {
        throw new MetadataConcurrencyError();
      }
      activeRequests += 1;

      const requestedUrl = input.trim();
      const deadlineController = new AbortController();
      let deadlineExpired = false;
      const timeout = setTimeout(() => {
        deadlineExpired = true;
        deadlineController.abort(new DOMException('Metadata deadline exceeded', 'TimeoutError'));
      }, METADATA_DEADLINE_MS);

      const abortForCaller = () => {
        deadlineController.abort(
          requestOptions.signal?.reason ?? new DOMException('Aborted', 'AbortError'),
        );
      };
      requestOptions.signal?.addEventListener('abort', abortForCaller, { once: true });

      try {
        throwIfCallerAborted(requestOptions.signal);
        let currentUrl = requestedUrl;
        let redirects = 0;

        while (true) {
          throwIfCallerAborted(requestOptions.signal);
          const destination = await raceWithAbort(
            validateMetadataDestination(currentUrl, dnsLookup),
            deadlineController.signal,
          );
          throwIfCallerAborted(requestOptions.signal);
          const response = await raceWithAbort(
            transportRequest({
              url: destination.url,
              address: destination.address,
              signal: deadlineController.signal,
            }),
            deadlineController.signal,
          );

          if (REDIRECT_STATUSES.has(response.status)) {
            await response.body?.cancel();
            if (redirects >= METADATA_MAX_REDIRECTS) {
              throw new MetadataRetrievalError();
            }
            const location = response.headers.get('location');
            if (location === null) throw new MetadataRetrievalError();
            try {
              currentUrl = new URL(location, destination.url).toString();
            } catch {
              throw new MetadataRetrievalError();
            }
            redirects += 1;
            continue;
          }

          if (response.status < 200 || response.status >= 300) {
            await response.body?.cancel();
            throw new MetadataRetrievalError();
          }
          if (headerSectionSize(response.headers) > METADATA_MAX_HEADER_BYTES) {
            await response.body?.cancel();
            throw new MetadataRetrievalError();
          }

          const contentType = response.headers
            .get('content-type')
            ?.split(';', 1)[0]
            ?.trim()
            .toLowerCase();
          if (contentType === undefined || !ALLOWED_CONTENT_TYPES.has(contentType)) {
            await response.body?.cancel();
            throw new MetadataRetrievalError();
          }

          const body = await readLimitedBody(
            response,
            METADATA_MAX_BODY_BYTES,
            deadlineController.signal,
          );
          const parsed = parsePageMetadata(body);
          if (parsed.title === null && parsed.description === null) {
            throw new MetadataRetrievalError();
          }

          return {
            requestedUrl,
            finalUrl: destination.url.toString(),
            outcome:
              parsed.title !== null && parsed.description !== null ? 'complete' : 'partial',
            title: parsed.title,
            description: parsed.description,
          };
        }
      } catch (error) {
        if (requestOptions.signal?.aborted && !deadlineExpired) {
          throw requestOptions.signal.reason ?? error;
        }
        if (
          error instanceof MetadataPolicyError ||
          error instanceof MetadataRetrievalError ||
          deadlineExpired ||
          error instanceof Error
        ) {
          return unavailable(requestedUrl);
        }
        return unavailable(requestedUrl);
      } finally {
        clearTimeout(timeout);
        requestOptions.signal?.removeEventListener('abort', abortForCaller);
        activeRequests -= 1;
      }
    },
  };
}

export type MetadataService = ReturnType<typeof createMetadataService>;
