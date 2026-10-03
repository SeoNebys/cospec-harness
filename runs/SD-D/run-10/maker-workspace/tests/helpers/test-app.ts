import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppConfig } from '../../src/server/config/schema';
import { buildApp } from '../../src/server/app';

export function createTestConfig(): AppConfig {
  const directory = mkdtempSync(join(tmpdir(), 'keepwell-test-'));
  return {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 0,
    databasePath: join(directory, 'test.sqlite'),
    assetDirectory: join(directory, 'assets'),
    appOrigins: new Set(['http://localhost']),
    sessionSecret: 'test-session-secret-with-at-least-32-bytes',
    sessionDays: 30,
    resetMinutes: 30,
    mailTransport: 'log',
    trustProxy: false,
  };
}

export async function createTestApp() {
  return buildApp({ config: createTestConfig() });
}

type TestSession = { cookie: string; csrf: string };

export function mutationHeaders(session: TestSession) {
  return { cookie: session.cookie, 'x-csrf-token': session.csrf, origin: 'http://localhost' };
}

function mergeCookies(current: string, setCookie: string | string[] | undefined): string {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const map = new Map(
    current
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.split('=', 2) as [string, string]),
  );
  for (const value of values) {
    const pair = value.split(';', 1)[0]!;
    const [name, cookieValue] = pair.split('=', 2);
    if (name && cookieValue) map.set(name, cookieValue);
  }
  return [...map].map(([name, value]) => `${name}=${value}`).join('; ');
}

export async function registerTestUser(
  app: Awaited<ReturnType<typeof createTestApp>>,
  email: string,
): Promise<TestSession> {
  const initial = await app.inject({ method: 'GET', url: '/api/auth/session' });
  let cookie = mergeCookies('', initial.headers['set-cookie']);
  const csrf = initial.json<{ csrfToken: string }>().csrfToken;
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { cookie, 'x-csrf-token': csrf, origin: 'http://localhost' },
    payload: { email, password: 'A very long test passphrase!' },
  });
  if (registration.statusCode !== 201) throw new Error(registration.body);
  cookie = mergeCookies(cookie, registration.headers['set-cookie']);
  return { cookie, csrf: registration.json<{ csrfToken: string }>().csrfToken };
}
