import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { AppError } from '@shared/errors.js';

const blocked = new Set([
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'loopback',
  'private',
  'reserved',
  'carrierGradeNat',
  'uniqueLocal'
]);
export function isPublicAddress(value: string): boolean {
  try {
    const parsed = ipaddr.process(value);
    return !blocked.has(parsed.range());
  } catch {
    return false;
  }
}
export async function resolvePublic(hostname: string) {
  const answers = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some((a) => !isPublicAddress(a.address)))
    throw new AppError(
      422,
      'METADATA_BLOCKED',
      'Metadata retrieval is blocked for private or local network addresses.'
    );
  return answers;
}
