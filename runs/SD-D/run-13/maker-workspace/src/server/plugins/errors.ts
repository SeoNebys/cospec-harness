import type { FastifyInstance } from 'fastify';
import { AppError } from '../../shared/api/errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const fieldErrors = error.details?.fieldErrors;
      return reply.status(error.statusCode).send({ code: error.code, message: error.message, ...(fieldErrors ? { fieldErrors } : {}), ...error.details });
    }
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? (error as { statusCode?: unknown }).statusCode : undefined;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({ code: 'BAD_REQUEST', message: 'The request could not be processed.' });
    }
    request.log.error({ err: error }, 'request failed');
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
  });
}
