import { AppError } from "@/lib/errors";

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const originUrl = new URL(origin);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  if (originUrl.host !== requestHost) throw new AppError("VALIDATION_ERROR", "Cross-origin changes are not allowed.", 403);
}
