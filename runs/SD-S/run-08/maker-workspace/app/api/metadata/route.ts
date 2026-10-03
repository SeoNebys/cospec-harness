import { NextResponse } from "next/server";
import { z } from "zod";
import { findBookmarkByUrlKey } from "@/lib/bookmarks/repository";
import { AppError, errorResponse } from "@/lib/errors";
import { createMetadataPreview } from "@/lib/metadata/service";
import { assertSameOrigin } from "@/lib/security/origin";
import { normalizeUrl } from "@/lib/urls/normalize";

export const runtime = "nodejs";
const requestSchema = z.object({ url: z.string().trim().min(1).max(2048) }).strict();

const windows = new Map<string, { count: number; reset: number }>();
function rateLimit(request: Request) {
  const now = Date.now();
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const current = windows.get(key);
  if (!current || current.reset <= now) { windows.set(key, { count: 1, reset: now + 60_000 }); return; }
  if (current.count >= 20) throw new AppError("RATE_LIMITED", "Too many previews. Please wait a moment.", 429);
  current.count += 1;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid URL.", 422, "url");
    const preview = await createMetadataPreview(parsed.data.url, {
      normalizeUrl,
      findExistingId: async (url) => (await findBookmarkByUrlKey(normalizeUrl(url).key))?.id ?? null
    });
    return NextResponse.json(preview);
  } catch (error) { return errorResponse(error); }
}
