import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Auth } from "../auth/auth.js";
import { requireSession } from "../auth/require-session.js";
import { createBookmarkSchema, updateBookmarkSchema } from "../../shared/validation/bookmark.js";
import { bookmarkQuerySchema } from "../../shared/validation/bookmark-query.js";
import { positiveId } from "../../shared/validation/common.js";
import type { BookmarkRepository } from "../repositories/bookmark-repository.js";
import type { IconRepository } from "../repositories/icon-repository.js";
import type { BookmarkService } from "../services/bookmark-service.js";
import { AppError } from "./errors.js";

const genericIcon = fs.readFileSync(path.resolve("public/generic-site-icon.svg"));

export function registerBookmarkRoutes(app: FastifyInstance, auth: Auth, repository: BookmarkRepository, icons: IconRepository, service: BookmarkService): void {
  app.get("/api/bookmarks", async (request) => {
    const session = await requireSession(auth, request);
    return repository.list(session.user.id, bookmarkQuerySchema.parse(request.query));
  });
  app.post("/api/bookmarks", async (request, reply) => {
    const session = await requireSession(auth, request);
    reply.status(201).send(service.create(session.user.id, createBookmarkSchema.parse(request.body)));
  });
  app.get("/api/bookmarks/:bookmarkId", async (request) => {
    const session = await requireSession(auth, request);
    const { bookmarkId } = z.object({ bookmarkId: positiveId }).parse(request.params);
    const bookmark = repository.find(session.user.id, bookmarkId);
    if (!bookmark) throw new AppError(404, "NOT_FOUND", "Bookmark not found");
    return bookmark;
  });
  app.patch("/api/bookmarks/:bookmarkId", async (request) => {
    const session = await requireSession(auth, request);
    const { bookmarkId } = z.object({ bookmarkId: positiveId }).parse(request.params);
    return service.update(session.user.id, bookmarkId, updateBookmarkSchema.parse(request.body));
  });
  app.delete("/api/bookmarks/:bookmarkId", async (request, reply) => {
    const session = await requireSession(auth, request);
    const { bookmarkId } = z.object({ bookmarkId: positiveId }).parse(request.params);
    service.delete(session.user.id, bookmarkId);
    reply.status(204).send();
  });
  app.put("/api/bookmarks/:bookmarkId/favorite", async (request) => {
    const session = await requireSession(auth, request);
    const { bookmarkId } = z.object({ bookmarkId: positiveId }).parse(request.params);
    return service.setFavorite(session.user.id, bookmarkId, true);
  });
  app.delete("/api/bookmarks/:bookmarkId/favorite", async (request) => {
    const session = await requireSession(auth, request);
    const { bookmarkId } = z.object({ bookmarkId: positiveId }).parse(request.params);
    return service.setFavorite(session.user.id, bookmarkId, false);
  });
  app.get("/api/bookmarks/:bookmarkId/icon", async (request, reply) => {
    const session = await requireSession(auth, request);
    const { bookmarkId } = z.object({ bookmarkId: positiveId }).parse(request.params);
    if (!repository.find(session.user.id, bookmarkId)) throw new AppError(404, "NOT_FOUND", "Bookmark not found");
    const icon = icons.findForBookmark(session.user.id, bookmarkId);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Content-Security-Policy", "default-src 'none'; sandbox");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    reply.header("Cache-Control", "private, max-age=3600");
    reply.type(icon?.mediaType ?? "image/svg+xml").send(icon?.bytes ?? genericIcon);
  });
}
