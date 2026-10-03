import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function requestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function apiError(request: Request, status: number, code: string, message: string) {
  return NextResponse.json({ code, message, requestId: requestId(request) }, { status });
}

export function validationError(request: Request, error: ZodError) {
  return NextResponse.json(
    {
      code: "VALIDATION_ERROR",
      message: "Please correct the highlighted fields.",
      requestId: requestId(request),
      fields: error.flatten().fieldErrors,
    },
    { status: 422 },
  );
}
