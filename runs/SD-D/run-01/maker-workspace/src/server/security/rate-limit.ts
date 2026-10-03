import type { FastifyReply, FastifyRequest } from 'fastify';

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();
let inFlight = 0;

export function enterRequest(request: FastifyRequest, reply: FastifyReply): boolean {
  if (inFlight >= 100) { reply.code(503).send({ error: { code: 'BUSY', message: 'The service is busy. Try again shortly.' } }); return false; }
  inFlight++;
  const sensitive = request.url.startsWith('/api/v1/metadata/') || request.url.startsWith('/api/v1/imports/') || request.url.startsWith('/api/v1/auth/');
  if (!sensitive) return true;
  const now = Date.now(); const key = `${request.ip}:${request.url.split('?')[0]}`; let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) { bucket = { count: 0, resetAt: now + 60_000 }; buckets.set(key, bucket); }
  bucket.count++;
  if (bucket.count > 60) { reply.header('retry-after', Math.ceil((bucket.resetAt - now) / 1000)); reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } }); return false; }
  return true;
}
export function leaveRequest(): void { inFlight = Math.max(0, inFlight - 1); }
