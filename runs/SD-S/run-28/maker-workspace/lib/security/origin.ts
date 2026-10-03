import { env } from "@/lib/config/env";

export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV === "test";
  const allowed = new Set([
    env().TRUSTED_ORIGIN,
    env().APP_BASE_URL,
    "http://maker:4000",
    "http://127.0.0.1:4000",
  ].map((value) => new URL(value).origin));
  try {
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
