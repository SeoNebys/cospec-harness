import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/contracts/problems.js';

export const notFound: RequestHandler = (_request, response) =>
  response.status(404).json({ code: 'NOT_FOUND', message: 'That resource was not found.' });

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;
  if (error instanceof ZodError) {
    return response.status(422).json({
      code: 'VALIDATION_ERROR',
      message: 'Please correct the highlighted fields.',
      issues: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  if (error instanceof AppError)
    return response
      .status(error.status)
      .json({ code: error.code, message: error.message, ...error.details });
  console.error(error);
  return response
    .status(500)
    .json({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
};
