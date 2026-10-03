import { Agent, request } from 'undici';
import { BlockedAddressError, resolvePublicAddresses } from './addressPolicy.js';

export interface RestrictedResponse {
  url: string;
  statusCode: number;
  contentType: string;
  body: Buffer;
}
export type RestrictedTransport = (url: string, signal?: AbortSignal) => Promise<RestrictedResponse>;
const MAX_BYTES = 2 * 1024 * 1024;

async function within<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('FETCH_TIMEOUT')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const restrictedFetch: RestrictedTransport = async (input, outerSignal) => {
  let current = new URL(input);
  if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password)
    throw new BlockedAddressError('Only public HTTP(S) addresses without credentials can be retrieved.');
  const started = Date.now();
  for (let hop = 0; hop <= 5; hop += 1) {
    const remaining = 10_000 - (Date.now() - started);
    if (remaining <= 0) throw new Error('FETCH_TIMEOUT');
    const addresses = await within(resolvePublicAddresses(current.hostname), Math.min(8_000, remaining));
    const selected = addresses[0]!;
    const dispatcher = new Agent({
      connect: {
        lookup: ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
          if (options?.all) callback(null, [{ address: selected.address, family: selected.family }]);
          else callback(null, selected.address, selected.family);
        }) as never,
      },
    });
    const timeout = AbortSignal.timeout(Math.min(8_000, remaining));
    const signal = outerSignal ? AbortSignal.any([outerSignal, timeout]) : timeout;
    try {
      const response = await request(current, {
        dispatcher,
        signal,
        headers: {
          accept: 'text/html,application/xhtml+xml,image/*;q=0.8',
          'user-agent': 'Pinboard Metadata Preview/1.0',
        },
        headersTimeout: Math.min(8_000, remaining),
        bodyTimeout: Math.min(8_000, remaining),
      });
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        await response.body.dump();
        if (!location || hop === 5) throw new Error('FETCH_REDIRECT_LIMIT');
        current = new URL(Array.isArray(location) ? location[0] : location, current);
        if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password)
          throw new BlockedAddressError('A redirect pointed to a blocked address.');
        continue;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      const declaredLength = Number(response.headers['content-length'] ?? 0);
      if (declaredLength > MAX_BYTES) {
        response.body.destroy();
        throw new Error('RESPONSE_TOO_LARGE');
      }
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        bytes += buffer.byteLength;
        if (bytes > MAX_BYTES) {
          response.body.destroy();
          throw new Error('RESPONSE_TOO_LARGE');
        }
        chunks.push(buffer);
      }
      const type = response.headers['content-type'];
      return {
        url: current.toString(),
        statusCode: response.statusCode,
        contentType: Array.isArray(type) ? (type[0] ?? '') : (type ?? ''),
        body: Buffer.concat(chunks),
      };
    } finally {
      await dispatcher.close();
    }
  }
  throw new Error('FETCH_REDIRECT_LIMIT');
};
