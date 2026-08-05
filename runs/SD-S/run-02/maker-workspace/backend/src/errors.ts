/** Application error carrying an HTTP status, a machine code, and a human message. */
export class AppError extends Error {
  status: number;
  code: string;
  /** Optional extra payload merged into the error response body. */
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const invalidUrl = (message: string) =>
  new AppError(400, "invalid_url", message);

export const invalidInput = (message: string) =>
  new AppError(400, "invalid_input", message);

export const notFound = (message = "Bookmark not found") =>
  new AppError(404, "not_found", message);
