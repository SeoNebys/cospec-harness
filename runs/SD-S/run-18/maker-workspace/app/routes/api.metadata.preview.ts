import type { ActionFunctionArgs } from "react-router";
import { requireResourceUser } from "~/auth/require-user.server";
import { db } from "~/db/client.server";
import { metadataPreviewInputSchema } from "~/features/bookmarks/bookmark.validation";
import { validationProblem, problem } from "~/lib/http-problem.server";
import { createMetadataService } from "~/services/metadata/metadata.service.server";
import { normalizeBookmarkUrl } from "~/features/bookmarks/url-normalization";
import { reserveMetadataPreview } from "~/services/metadata/metadata-rate-limit.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireResourceUser(request);
  const parsed = metadataPreviewInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationProblem(parsed.error);
  let normalized: string;
  try { normalized = normalizeBookmarkUrl(parsed.data.url); }
  catch (error) { return problem(422, "VALIDATION_ERROR", error instanceof Error ? error.message : "Enter a valid web address."); }
  const release = reserveMetadataPreview(user.id, new URL(normalized).hostname);
  if (!release) return problem(429, "RATE_LIMITED", "Please wait before retrieving more page details.");
  try {
    return Response.json(await createMetadataService(db).preview(user.id, normalized, parsed.data.requestId));
  } catch (error) {
    return problem(422, "VALIDATION_ERROR", error instanceof Error ? error.message : "Enter a valid web address.");
  } finally {
    release();
  }
}
