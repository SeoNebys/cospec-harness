import "server-only";
import { getConfig } from "@/lib/config";
import { requireApiSession } from "@/lib/auth/session";
import { verifyCsrfToken } from "@/lib/security/csrf";
import { problem, unauthorized } from "./problem";

export async function guardApiRequest(request: Request, options: { csrf?: boolean } = {}) {
  const session = await requireApiSession(request);
  if (!session) return { response: unauthorized() } as const;

  if (options.csrf) {
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(getConfig().APP_BASE_URL).origin;
    const allowedOrigins = new Set([expectedOrigin, "http://maker:4000", "http://127.0.0.1:4000"]);
    const fetchSite = request.headers.get("sec-fetch-site");
    if ((origin && !allowedOrigins.has(origin)) || fetchSite === "cross-site") {
      return { response: problem(403, "Cross-site request blocked") } as const;
    }
    if (!verifyCsrfToken(session.session.id, request.headers.get("x-csrf-token"))) {
      return { response: problem(403, "Invalid security token", "Refresh the page and try again.") } as const;
    }
  }
  return { session } as const;
}
