import { describe, expect, it } from 'vitest';
import { isPublicAddress } from '@server/metadata/ip-policy.js';
import { testApp } from '../helpers/http.js';
describe('security regressions', () => {
  it('blocks local, private, link-local and special network targets', () => {
    for (const value of [
      '127.0.0.1',
      '0.0.0.0',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.1.1',
      '::1',
      'fc00::1',
      'fe80::1'
    ])
      expect(isPublicAddress(value), value).toBe(false);
    expect(isPublicAddress('93.184.216.34')).toBe(true);
  });
  it('does not expose icons or exports without a session and rejects foreign origins', async () => {
    const t = await testApp();
    await (await import('supertest')).default(t.app).get('/api/exports/bookmarks.html').expect(401);
    await t.agent
      .post('/api/bookmarks')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', t.csrf)
      .send({ url: 'https://example.com' })
      .expect(403);
    t.cleanup();
  });
});
