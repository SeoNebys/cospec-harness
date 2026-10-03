import { lookup as dnsLookup } from 'node:dns/promises';
import { Agent, request } from 'undici';
import { allowedFetchHost, isPublicAddress } from '../../security/ip-policy.js';

export interface FetchBudgets { timeoutMs: number; maxBytes: number; allowedTypes: string[]; maxRedirects?: number }
export interface SafeResponse { url: string; contentType: string; body: Buffer }
export interface Resolver { (hostname: string): Promise<Array<{ address: string; family: number }>> }

const defaultResolver: Resolver = async hostname => dnsLookup(hostname, { all: true, verbatim: true });

export async function safeFetch(input: string, budgets: FetchBudgets, resolver: Resolver = defaultResolver): Promise<SafeResponse> {
  let current = new URL(input);
  const visited = new Set<string>();
  const hops = budgets.maxRedirects ?? 5;
  for (let hop = 0; hop <= hops; hop++) {
    if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password || current.port && !['80','443'].includes(current.port)) throw new Error('Destination is not allowed.');
    if (!allowedFetchHost(current.hostname)) throw new Error('Destination host is not allowed.');
    if (visited.has(current.href)) throw new Error('Redirect cycle detected.');
    visited.add(current.href);
    const addresses = await resolver(current.hostname);
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Destination does not resolve to a public address.');
    const pinned = addresses[0]!;
    const agent = new Agent({ connect: { lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family as 4 | 6) } });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budgets.timeoutMs);
    try {
      const response = await request(current, { dispatcher: agent, method: 'GET', signal: controller.signal, headers: { 'user-agent': 'Keepmark Metadata Preview/1.0', accept: budgets.allowedTypes.join(', ') } });
      if ([301,302,303,307,308].includes(response.statusCode)) {
        const location = response.headers.location;
        await response.body.dump();
        if (!location || hop === hops) throw new Error('Too many redirects.');
        const next = new URL(Array.isArray(location) ? location[0]! : location, current);
        if (current.protocol === 'https:' && next.protocol !== 'https:') throw new Error('HTTPS downgrade redirect rejected.');
        current = next; continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) { await response.body.dump(); throw new Error(`Destination returned HTTP ${response.statusCode}.`); }
      const contentType = String(response.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
      if (!budgets.allowedTypes.some(type => contentType === type || (type.endsWith('/*') && contentType.startsWith(type.slice(0,-1))))) { await response.body.dump(); throw new Error('Destination returned an unsupported content type.'); }
      const declared = Number(response.headers['content-length'] ?? 0);
      if (declared > budgets.maxBytes) { await response.body.dump(); throw new Error('Destination content is too large.'); }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of response.body) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > budgets.maxBytes) throw new Error('Destination content is too large.'); chunks.push(buffer); }
      return { url: current.href, contentType, body: Buffer.concat(chunks) };
    } finally { clearTimeout(timer); await agent.close(); }
  }
  throw new Error('Too many redirects.');
}
