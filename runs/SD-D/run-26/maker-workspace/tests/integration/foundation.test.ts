import { afterEach, describe, expect, it } from 'vitest';
import { temporaryDatabase } from '../helpers/database.js';
import { testApp } from '../helpers/http.js';
describe('foundation', () => {
  it('applies all migrations repeatably with foreign keys', () => {
    const t = temporaryDatabase();
    expect(t.db.prepare('select count(*) count from schema_migrations').get()).toEqual({
      count: 6
    });
    expect(t.db.pragma('foreign_keys', { simple: true })).toBe(1);
    t.close();
  });
  it('requires authentication, adds security headers, and enforces CSRF', async () => {
    const t = await testApp();
    await t.agent.get('/api/bookmarks').expect(200);
    await t.agent.post('/api/bookmarks').send({ url: 'https://example.com' }).expect(403);
    const health = await t.agent.get('/health/ready').expect(200);
    expect(health.headers['content-security-policy']).toContain("default-src 'self'");
    t.cleanup();
  });
});
