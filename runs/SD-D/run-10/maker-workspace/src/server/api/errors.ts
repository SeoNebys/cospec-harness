import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function installErrorHandler(app: {
  setErrorHandler: (handler: (error: Error, request: FastifyRequest, reply: FastifyReply) => void) => void;
}): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return void reply.status(422).send({
        type: 'https://bookmark.local/problems/validation',
        title: 'Request validation failed',
        status: 422,
        detail: 'One or more fields need attention.',
        code: 'validation_failed',
        errors: error.issues.map((issue) => ({
          field: issue.path.join('.') || 'request',
          code: issue.code,
          message: issue.message,
        })),
        requestId: request.id,
      });
    }
    if (error instanceof AppError) {
      return void reply.status(error.status).send({
        type: `https://bookmark.local/problems/${error.code.replaceAll('_', '-')}`,
        title: titleFor(error.status, error.code),
        status: error.status,
        detail: error.message,
        code: error.code,
        requestId: request.id,
        ...error.extra,
      });
    }
    request.log.error({ err: error }, 'Unhandled request failure');
    void reply.status(500).send({
      type: 'https://bookmark.local/problems/internal',
      title: 'Something went wrong',
      status: 500,
      detail: 'The operation could not be completed. Please try again.',
      code: 'internal_error',
      requestId: request.id,
    });
  });
}

function titleFor(status: number, code?: string): string {
  if (code === 'invalid_search') return 'Search expression is invalid';
  if (code === 'duplicate_bookmark') return 'Bookmark already exists';
  if (status === 401) return 'Sign in required';
  if (status === 403) return 'Request not allowed';
  if (status === 404) return 'Not found';
  if (status === 409) return 'Request conflicts with current data';
  if (status === 422) return 'Request validation failed';
  if (status === 429) return 'Too many requests';
  return 'Request failed';
}
