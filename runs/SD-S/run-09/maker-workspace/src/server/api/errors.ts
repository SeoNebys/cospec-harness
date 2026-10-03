import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) fieldErrors[issue.path.join(".") || "form"] = issue.message;
    reply.status(400).send({ code: "VALIDATION_ERROR", message: "Check the highlighted fields", fieldErrors });
    return;
  }
  if (error instanceof AppError) {
    reply.status(error.status).send({ code: error.code, message: error.message, ...error.details });
    return;
  }
  request.log.error({ err: error }, "request failed");
  reply.status(500).send({ code: "INTERNAL_ERROR", message: "Something went wrong", requestId: request.id });
}
