import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

export function problem(status: number, code: string, detail: string, extra: Record<string, unknown> = {}) {
  return { type: `/problems/${code}`, title: code.replaceAll('_', ' '), status, code, detail, ...extra };
}

export const notFound: RequestHandler = (_req, res) => res.status(404).type('application/problem+json').json(problem(404, 'not_found', 'The requested resource was not found.'));

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) return res.status(error.status).type('application/problem+json').json(problem(error.status, error.code, error.message, error.extra));
  if (error instanceof ZodError) return res.status(422).type('application/problem+json').json(problem(422, 'validation_error', error.issues[0]?.message ?? 'Invalid request.'));
  console.error('request_failed', error instanceof Error ? error.message : 'unknown');
  return res.status(500).type('application/problem+json').json(problem(500, 'internal_error', 'The request could not be completed.'));
};
