import { NextResponse } from "next/server";

export function problem(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ code, message, ...extra }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function privateJson(data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, { ...init, headers: { ...init.headers, "Cache-Control": "private, no-store" } });
}
