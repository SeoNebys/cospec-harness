import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { DomUtils, parseDocument } from 'htmlparser2';
import ipaddr from 'ipaddr.js';
import { parseHttpUrl } from '../bookmarks/url-normalization.js';

export type TitlePreviewResult =
  | { status: 'found'; title: string }
  | {
      status: 'unavailable';
      title: null;
      reason:
        | 'missing_title'
        | 'blocked_destination'
        | 'timeout'
        | 'non_html'
        | 'too_large'
        | 'network_error';
    };

const MAX_BYTES = 1_048_576;
const MAX_REDIRECTS = 3;

export function extractTitle(html: string): string | null {
  const document = parseDocument(html);
  const titleElement = DomUtils.findOne(
    (element) => element.type === 'tag' && element.name.toLocaleLowerCase() === 'title',
    document.children,
  );
  const title = titleElement
    ? DomUtils.textContent(titleElement).replace(/\s+/g, ' ').trim().slice(0, 300)
    : '';
  return title || null;
}

function publicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress())
      parsed = parsed.toIPv4Address();
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

async function resolvePublic(hostname: string) {
  const cleanHostname =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (cleanHostname.toLocaleLowerCase() === 'localhost' || cleanHostname.endsWith('.localhost'))
    throw new Error('blocked');
  if (ipaddr.isValid(cleanHostname)) {
    if (!publicAddress(cleanHostname)) throw new Error('blocked');
    return {
      address: cleanHostname,
      family: ipaddr.parse(cleanHostname).kind() === 'ipv6' ? 6 : 4,
    };
  }
  const records = await dns.lookup(cleanHostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => !publicAddress(record.address)))
    throw new Error('blocked');
  return records.find((record) => record.family === 4) ?? records[0];
}

async function requestPage(
  url: URL,
  deadline: number,
): Promise<{ redirect?: string; html?: string; reason?: 'non_html' | 'too_large' }> {
  const record = await resolvePublic(url.hostname);
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('timeout');
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: 'GET',
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9',
          'user-agent': 'KeepsakeTitlePreview/1.0',
        },
        timeout: remaining,
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            const returnMany = callback as unknown as (
              error: null,
              addresses: { address: string; family: number }[],
            ) => void;
            returnMany(null, [record]);
          } else {
            callback(null, record.address, record.family);
          }
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          return resolve({ redirect: new URL(response.headers.location, url).toString() });
        }
        const contentType = String(response.headers['content-type'] ?? '').toLocaleLowerCase();
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          response.resume();
          return resolve({ reason: 'non_html' });
        }
        const declared = Number(response.headers['content-length'] ?? 0);
        if (declared > MAX_BYTES) {
          response.resume();
          return resolve({ reason: 'too_large' });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            settled = true;
            response.destroy();
            resolve({ reason: 'too_large' });
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          if (!settled) resolve({ html: Buffer.concat(chunks).toString('utf8') });
        });
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', reject);
    request.end();
  });
}

export async function fetchTitle(value: string): Promise<TitlePreviewResult> {
  let url: URL;
  try {
    url = parseHttpUrl(value);
  } catch {
    return { status: 'unavailable', title: null, reason: 'blocked_destination' };
  }
  const deadline = Date.now() + 5_000;
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const result = await requestPage(url, deadline);
      if (result.redirect) {
        if (redirects === MAX_REDIRECTS)
          return { status: 'unavailable', title: null, reason: 'network_error' };
        url = parseHttpUrl(result.redirect);
        continue;
      }
      if (result.reason)
        return {
          status: 'unavailable',
          title: null,
          reason: result.reason as 'non_html' | 'too_large',
        };
      const title = extractTitle(result.html ?? '');
      return title
        ? { status: 'found', title }
        : { status: 'unavailable', title: null, reason: 'missing_title' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'blocked')
      return { status: 'unavailable', title: null, reason: 'blocked_destination' };
    if (message === 'timeout') return { status: 'unavailable', title: null, reason: 'timeout' };
  }
  return { status: 'unavailable', title: null, reason: 'network_error' };
}
