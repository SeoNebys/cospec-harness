// Standard error shape and helpers (contracts/api.md).

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const invalidUrl = (message = 'The address is not a valid web URL.') =>
  new ApiError(400, 'invalid_url', message);

export const duplicate = (existingId) =>
  new ApiError(409, 'duplicate', 'This address is already bookmarked.', { existingId });

export const invalidQuery = (message = 'The search query is malformed.') =>
  new ApiError(400, 'invalid_query', message);

export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);

export const validationError = (message = 'Invalid request.') =>
  new ApiError(400, 'validation_error', message);

// Express error-handling middleware.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.extra && err.extra.existingId != null) body.existingId = err.extra.existingId;
    return res.status(err.status).json(body);
  }
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  return res
    .status(500)
    .json({ error: { code: 'internal', message: 'Internal server error.' } });
}
