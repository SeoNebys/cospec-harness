import type { RequestHandler } from 'express';

type Bucket = { count: number; resetAt: number };
export function rateLimit(limit: number, windowMs: number): RequestHandler {
  const buckets = new Map<string, Bucket>();
  return (request, response, next) => {
    const key = `${request.ip}:${request.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > limit) {
      response.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return response
        .status(429)
        .json({ code: 'RATE_LIMITED', message: 'Too many attempts. Please wait and try again.' });
    }
    next();
  };
}
