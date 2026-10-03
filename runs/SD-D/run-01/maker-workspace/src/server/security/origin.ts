import type { FastifyRequest } from 'fastify';

export function isAllowedOrigin(request: FastifyRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.origin;
  if (!origin) return true;
  const forwarded = request.headers['x-forwarded-host'];
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? request.headers.host;
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
