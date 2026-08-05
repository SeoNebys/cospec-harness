import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Application error carrying an HTTP status, a stable machine code, and a
 * user-friendly message. Serialized as { error: { code, message } }
 * (contracts/api.md).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, code = "INVALID_INPUT") =>
  new AppError(400, code, message);

export const notFound = (message = "Resource not found", code = "NOT_FOUND") =>
  new AppError(404, code, message);

export const duplicate = (message: string, details: unknown) =>
  new AppError(409, "DUPLICATE_BOOKMARK", message, details);

/** Register a consistent JSON error shape for the whole API. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: unknown, _req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof AppError) {
      reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
      return;
    }
    const message = err instanceof Error ? err.message : "Unexpected error";
    app.log.error(err);
    reply.status(500).send({ error: { code: "INTERNAL_ERROR", message } });
  });
}
