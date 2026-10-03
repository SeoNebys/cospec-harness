import { NextResponse } from "next/server";
import { z } from "zod";
import { applyBulkAction } from "@/features/bookmarks/bulk-service";
import { guardApiRequest } from "@/lib/http/guard-request";
import { problem } from "@/lib/http/problem";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  operation: z.enum(["add_tags", "remove_tags", "mark_read", "mark_unread", "archive", "restore", "permanent_delete"]),
  tagNames: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  confirmPermanent: z.boolean().optional(),
  expectedCount: z.number().int().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  const guarded = await guardApiRequest(request, { csrf: true });
  if ("response" in guarded) return guarded.response;
  try {
    const result = applyBulkAction(guarded.session.user.id, schema.parse(await request.json()));
    return NextResponse.json(result);
  } catch (error) {
    return problem(422, "Bulk action needs attention", error instanceof Error ? error.message : "Check the selected bookmarks and try again.");
  }
}
