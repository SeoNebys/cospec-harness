import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { AppError } from '@shared/errors.js';
import { parseHttpUrl } from '@shared/url.js';
import { resolvePublic } from './ip-policy.js';
const MAX_WIRE = 1_500_000,
  MAX_DECODED = 3_000_000;
export type SafeResponse = {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
  location?: string;
};
export async function safeFetch(
  input: string,
  accept = 'text/html,application/xhtml+xml',
  redirects = 0
): Promise<SafeResponse> {
  const url = parseHttpUrl(input);
  if (url.username || url.password)
    throw new AppError(
      422,
      'METADATA_BLOCKED',
      'Addresses containing credentials cannot be retrieved.'
    );
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (![80, 443].includes(port))
    throw new AppError(
      422,
      'METADATA_BLOCKED',
      'Metadata retrieval only supports standard web ports.'
    );
  const answers = await resolvePublic(url.hostname);
  const pinned = answers[0]!;
  const response = await new Promise<SafeResponse>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      url,
      {
        method: 'GET',
        headers: {
          accept,
          'accept-encoding': 'gzip, deflate, br',
          'user-agent': 'LarderBookmarkPreview/1.0'
        },
        lookup: ((_host: string, options: { all?: boolean }, cb: (...args: any[]) => void) => {
          if (options?.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
          else cb(null, pinned.address, pinned.family);
        }) as any,
        timeout: 4500,
        maxHeaderSize: 16_384
      },
      (res) => {
        const remote = res.socket.remoteAddress?.replace(/^::ffff:/, '');
        if (remote && remote !== pinned.address.replace(/^::ffff:/, '')) {
          req.destroy();
          reject(
            new AppError(422, 'METADATA_BLOCKED', 'The remote address changed during connection.')
          );
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        res.on('data', (chunk: Buffer) => {
          length += chunk.length;
          if (length > MAX_WIRE) {
            req.destroy(new AppError(413, 'TOO_LARGE', 'The remote page is too large to preview.'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            let body = Buffer.concat(chunks);
            const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
            if (enc === 'gzip') body = zlib.gunzipSync(body, { maxOutputLength: MAX_DECODED });
            else if (enc === 'deflate')
              body = zlib.inflateSync(body, { maxOutputLength: MAX_DECODED });
            else if (enc === 'br')
              body = zlib.brotliDecompressSync(body, { maxOutputLength: MAX_DECODED });
            if (body.length > MAX_DECODED)
              throw new AppError(413, 'TOO_LARGE', 'The decoded page is too large to preview.');
            resolve({
              url: url.href,
              status: res.statusCode ?? 0,
              contentType: String(res.headers['content-type'] ?? ''),
              body,
              location: typeof res.headers.location === 'string' ? res.headers.location : undefined
            });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('timeout', () =>
      req.destroy(new AppError(422, 'METADATA_UNAVAILABLE', 'The page took too long to respond.'))
    );
    req.on('error', reject);
    req.end();
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= 4)
      throw new AppError(422, 'METADATA_UNAVAILABLE', 'The page redirected too many times.');
    const location = response.location ?? null;
    if (!location)
      throw new AppError(422, 'METADATA_UNAVAILABLE', 'The page returned an invalid redirect.');
    const next = new URL(location, url);
    if (url.protocol === 'https:' && next.protocol !== 'https:')
      throw new AppError(
        422,
        'METADATA_BLOCKED',
        'Secure pages cannot redirect metadata retrieval to an insecure address.'
      );
    return safeFetch(next.href, accept, redirects + 1);
  }
  if (response.status < 200 || response.status >= 300)
    throw new AppError(
      422,
      'METADATA_UNAVAILABLE',
      `The page responded with status ${response.status}.`
    );
  return response;
}
