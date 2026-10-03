import type { FastifyInstance } from 'fastify';
import { AppError } from '../api/errors.js';

type Window = { startedAt: number; count: number };

export function installSecurity(app: FastifyInstance): void {
  const windows = new Map<string, Window>();
  app.addHook('preHandler', async (request) => {
    const route = request.routeOptions.url ?? request.url;
    const limit =
      route === '/api/metadata/preview' || route === '/api/media/capture'
        ? 20
        : route === '/api/auth/login' || route.startsWith('/api/auth/password-reset')
          ? 30
          : 0;
    if (!limit) return;
    const now = Date.now();
    const key = `${request.ip}:${route}`;
    const current = windows.get(key);
    const entry = !current || now - current.startedAt >= 60_000 ? { startedAt: now, count: 0 } : current;
    entry.count += 1;
    windows.set(key, entry);
    if (entry.count > limit)
      throw new AppError(429, 'rate_limited', 'Too many requests. Wait a moment and try again.');
    if (windows.size > 5_000) {
      for (const [candidate, value] of windows)
        if (now - value.startedAt >= 60_000) windows.delete(candidate);
    }
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    return payload;
  });
}
