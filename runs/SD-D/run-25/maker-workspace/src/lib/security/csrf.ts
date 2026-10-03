import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/config";

export function issueCsrfToken(sessionId: string): string {
  return createHmac("sha256", getConfig().BETTER_AUTH_SECRET)
    .update(`csrf:${sessionId}`)
    .digest("base64url");
}

export function verifyCsrfToken(sessionId: string, candidate: string | null): boolean {
  if (!candidate) return false;
  const expected = issueCsrfToken(sessionId);
  const left = Buffer.from(expected);
  const right = Buffer.from(candidate);
  return left.length === right.length && timingSafeEqual(left, right);
}
