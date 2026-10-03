import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { issueCsrfToken } from "@/lib/security/csrf";
import { unauthorized } from "@/lib/http/problem";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (!session) return unauthorized();
  return NextResponse.json(
    { token: issueCsrfToken(session.session.id) },
    { headers: { "cache-control": "no-store" } },
  );
}
