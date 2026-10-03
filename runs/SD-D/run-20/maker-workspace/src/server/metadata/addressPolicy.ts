import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export class BlockedAddressError extends Error {}

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as Array<[string, number]>)
  blocked.addSubnet(network, prefix, 'ipv4');

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as Array<[string, number]>)
  blocked.addSubnet(network, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const plainAddress = address.split('%')[0]!;
  const family = isIP(plainAddress);
  if (family === 6 && plainAddress.toLowerCase().startsWith('::ffff:')) return false;
  return family === 4
    ? !blocked.check(plainAddress, 'ipv4')
    : family === 6
      ? !blocked.check(plainAddress, 'ipv6')
      : false;
}

export async function resolvePublicAddresses(
  hostname: string,
): Promise<Array<{ address: string; family: 4 | 6 }>> {
  const answers = await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some((answer) => !isPublicAddress(answer.address)))
    throw new BlockedAddressError('This address resolves to a network location that cannot be retrieved.');
  return answers.map((answer) => ({ address: answer.address, family: answer.family as 4 | 6 }));
}
