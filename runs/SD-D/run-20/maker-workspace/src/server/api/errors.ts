import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { SearchSyntaxError } from '../search/parse.js';
import { UrlValidationError } from '../services/url.js';

export function installErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof SearchSyntaxError)
      return reply.status(422).send({
        code: 'INVALID_SEARCH_QUERY',
        message: error.message,
        query: error.query,
        offset: error.offset,
        length: error.length,
        expected: error.expected,
      });
    if (error instanceof ZodError)
      return reply.status(422).send({
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted information.',
        details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      });
    if (error instanceof UrlValidationError)
      return reply.status(422).send({ code: 'INVALID_URL', message: error.message, field: 'url' });
    const typed = error as Error & { statusCode?: number; code?: string; existingBookmarkId?: string };
    const status =
      typed.statusCode && typed.statusCode >= 400 && typed.statusCode < 600 ? typed.statusCode : 500;
    const body: Record<string, unknown> = {
      code: typed.code ?? (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message: status === 500 ? 'Something went wrong. Please try again.' : typed.message,
    };
    if (typed.existingBookmarkId) body.existingBookmarkId = typed.existingBookmarkId;
    if (status === 500) app.log.error(error);
    return reply.status(status).send(body);
  });
}
