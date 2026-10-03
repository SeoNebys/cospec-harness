import { expect, it } from 'vitest';
import { isPublicAddress } from '../../src/server/metadata/addressPolicy';
it.each([
  '127.0.0.1',
  '10.0.0.1',
  '172.16.0.1',
  '192.168.1.1',
  '169.254.1.1',
  '0.0.0.0',
  '224.0.0.1',
  '::1',
  'fc00::1',
  'fe80::1',
  'ff02::1',
  '2001:db8::1',
  '::ffff:127.0.0.1',
])('blocks non-public address %s', (address) => expect(isPublicAddress(address)).toBe(false));
it.each(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'])('allows public address %s', (address) =>
  expect(isPublicAddress(address)).toBe(true),
);
