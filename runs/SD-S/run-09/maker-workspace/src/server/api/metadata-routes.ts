import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Auth } from "../auth/auth.js";
import { requireSession } from "../auth/require-session.js";
import type { MetadataService } from "../metadata/metadata-service.js";
import type { BookmarkService } from "../services/bookmark-service.js";
import { bookmarkUrlSchema } from "../../shared/validation/bookmark.js";
import { positiveId } from "../../shared/validation/common.js";

export function registerMetadataRoutes(app: FastifyInstance, auth: Auth, metadata: MetadataService, bookmarks: BookmarkService): void {
  app.post("/api/metadata/preview", async (request) => {
    const session = await requireSession(auth, request);
    const { url } = z.object({ url: bookmarkUrlSchema }).parse(request.body);
    return metadata.preview(session.user.id, url);
  });
  app.post("/api/bookmarks/:bookmarkId/metadata/retry", async (request, reply) => {
    const session = await requireSession(auth, request);
    const { bookmarkId } = z.object({ bookmarkId: positiveId }).parse(request.params);
    bookmarks.retry(session.user.id, bookmarkId);
    reply.status(202).send({ accepted: true });
  });
}
