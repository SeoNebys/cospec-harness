import type { RequestHandler } from 'express';

export const requestLog: RequestHandler = (request, response, next) => {
  const started = Date.now();
  response.on('finish', () => {
    if (process.env.NODE_ENV !== 'test')
      console.info(
        JSON.stringify({
          method: request.method,
          path: request.path,
          status: response.statusCode,
          durationMs: Date.now() - started,
        }),
      );
  });
  next();
};
