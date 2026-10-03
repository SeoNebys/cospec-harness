import { NextResponse } from "next/server";

export type ErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "DUPLICATE_URL" | "RATE_LIMITED" | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly field?: string,
    public readonly existingId?: string
  ) { super(message); this.name = "AppError"; }
}

export function errorResponse(error: unknown): NextResponse {
  const known = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "That action could not be completed.", 500);
  return NextResponse.json({ error: {
    code: known.code,
    message: known.message,
    ...(known.field ? { field: known.field } : {}),
    ...(known.existingId ? { existingId: known.existingId } : {})
  } }, { status: known.status });
}
