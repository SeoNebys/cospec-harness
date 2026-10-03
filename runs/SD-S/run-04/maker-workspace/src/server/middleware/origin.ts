import type { RequestHandler } from 'express';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export const verifyOrigin: RequestHandler = (request, response, next) => {
  if (SAFE.has(request.method)) return next();
  const origin = request.get('origin');
  if (!origin) return next();
  try {
    const parsed = new URL(origin);
    if (parsed.host === request.get('host')) return next();
  } catch {
    /* handled below */
  }
  return response
    .status(403)
    .json({ code: 'ORIGIN_REJECTED', message: 'The request origin was not accepted.' });
};
