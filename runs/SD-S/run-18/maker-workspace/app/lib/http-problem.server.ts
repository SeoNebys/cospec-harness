import type { ZodError } from "zod";

export type ProblemCode = "UNAUTHENTICATED" | "BOOKMARK_NOT_FOUND" | "DUPLICATE_BOOKMARK" | "VALIDATION_ERROR" | "RATE_LIMITED";

export function problem(status: number, code: ProblemCode, message: string, extra?: Record<string, unknown>) {
  return Response.json({ code, message, ...extra }, { status });
}

export function validationProblem(error: ZodError) {
  return problem(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
    fields: error.issues.map((issue) => ({ field: issue.path.join(".") || "form", message: issue.message })),
  });
}

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
