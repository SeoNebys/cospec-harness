import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import type { ApiErrorBody } from '../../shared/bookmark-types.js';
import { AppError } from '../errors.js';

const zodFieldErrors = (error: ZodError): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? 'request';
    (result[key] ??= []).push(issue.message);
  }
  return result;
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields.',
        fieldErrors: zodFieldErrors(error),
      },
    };
    response.status(400).json(body);
    return;
  }

  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        ...(error.existingBookmarkId ? { existingBookmarkId: error.existingBookmarkId } : {}),
      },
    };
    response.status(error.status).json(body);
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(error);
  }
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  };
  response.status(500).json(body);
};
