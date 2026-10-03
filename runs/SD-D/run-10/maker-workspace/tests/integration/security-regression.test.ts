import { markdownToPlainText } from '../../src/server/domain/note-text';
import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, registerTestUser } from '../helpers/test-app';

describe('security regression', () => {
  it('rejects CSRF, sanitizes plain-note projection, and parameterizes search syntax', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'security@example.test');
    expect(
      markdownToPlainText('<script>alert(1)</script> [safe](javascript:alert(1)) **bold**'),
    ).not.toContain('<script>');
    const csrf = await app.inject({
      method: 'POST',
      url: '/api/tags',
      headers: { cookie: session.cookie, origin: 'http://evil.test' },
      payload: { name: 'unsafe' },
    });
    expect(csrf.statusCode).toBe(403);
    await createBookmark(app, session, {
      title: 'Security target',
      noteMarkdown: '<script>alert(1)</script> **safe**',
    });
    for (const query of [`' OR 1=1 --`, 'privacy) OR (1=1', 'title:*']) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/bookmarks?query=${encodeURIComponent(query)}`,
        headers: { cookie: session.cookie },
      });
      expect([200, 422]).toContain(response.statusCode);
      expect(response.statusCode).not.toBe(500);
    }
    const headers = await app.inject({ method: 'GET', url: '/health/live' });
    expect(headers.headers['x-content-type-options']).toBe('nosniff');
    expect(headers.headers['content-security-policy']).toContain("default-src 'self'");
    await app.close();
  });

  it('throttles repeated recovery attempts', async () => {
    const app = await createTestApp();
    const initial = await app.inject({ method: 'GET', url: '/api/auth/session' });
    const cookie = (
      Array.isArray(initial.headers['set-cookie'])
        ? initial.headers['set-cookie'][0]
        : initial.headers['set-cookie']
    )!.split(';')[0];
    const csrf = initial.json().csrfToken;
    let status = 0;
    for (let index = 0; index < 31; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset/request',
        headers: { cookie, 'x-csrf-token': csrf, origin: 'http://localhost' },
        payload: { email: 'nobody@example.test' },
      });
      status = response.statusCode;
    }
    expect(status).toBe(429);
    await app.close();
  });
});
