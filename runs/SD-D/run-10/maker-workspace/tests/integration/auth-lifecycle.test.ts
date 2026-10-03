import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerTestUser } from '../helpers/test-app';

describe('authentication lifecycle', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it('revokes a session on logout', async () => {
    app = await createTestApp();
    const session = await registerTestUser(app, 'logout@example.test');
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: session.cookie, 'x-csrf-token': session.csrf, origin: 'http://localhost' },
    });
    expect(logout.statusCode).toBe(204);
    const later = await app.inject({
      method: 'GET',
      url: '/api/bookmarks',
      headers: { cookie: session.cookie },
    });
    expect(later.statusCode).toBe(401);
  });
});
