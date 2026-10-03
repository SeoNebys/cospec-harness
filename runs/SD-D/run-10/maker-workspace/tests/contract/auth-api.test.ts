import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerTestUser } from '../helpers/test-app';

describe('authentication API', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it('requires CSRF and keeps recovery enumeration-safe', async () => {
    app = await createTestApp();
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} })).statusCode).toBe(403);
    const initial = await app.inject({ method: 'GET', url: '/api/auth/session' });
    const csrf = initial.json<{ csrfToken: string }>().csrfToken;
    const setCookie = initial.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.split(';')[0])
      .join('; ');
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      headers: { cookie, 'x-csrf-token': csrf, origin: 'http://localhost' },
      payload: { email: 'missing@example.test' },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().message).toMatch(/If that account exists/);

    const crossSite = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      headers: {
        cookie,
        'x-csrf-token': csrf,
        origin: 'https://hostile.example',
        'sec-fetch-site': 'cross-site',
      },
      payload: { email: 'missing@example.test' },
    });
    expect(crossSite.statusCode).toBe(403);
  });

  it('reports liveness and readiness', async () => {
    app = await createTestApp();
    expect((await app.inject({ method: 'GET', url: '/health/live' })).json()).toEqual({ status: 'ok' });
    expect((await app.inject({ method: 'GET', url: '/health/ready' })).json()).toEqual({ status: 'ready' });
  });

  it('creates a private authenticated session', async () => {
    app = await createTestApp();
    const session = await registerTestUser(app, 'owner@example.test');
    const result = await app.inject({
      method: 'GET',
      url: '/api/bookmarks',
      headers: { cookie: session.cookie },
    });
    expect(result.statusCode).toBe(200);
  });

  it('preserves the session-bound CSRF token across a session refresh', async () => {
    app = await createTestApp();
    const registered = await registerTestUser(app, 'reload@example.test');
    const refreshed = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: registered.cookie },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json<{ csrfToken: string }>().csrfToken).toBe(registered.csrf);
    expect(refreshed.headers['set-cookie']).toBeUndefined();

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: registered.cookie,
        'x-csrf-token': registered.csrf,
        origin: 'http://localhost',
      },
    });
    expect(logout.statusCode).toBe(204);
  });
});
