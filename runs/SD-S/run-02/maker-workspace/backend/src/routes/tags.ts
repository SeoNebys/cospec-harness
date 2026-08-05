import type { FastifyInstance } from "fastify";
import type { BookmarkService } from "../services/bookmarks.js";

export function registerTagRoutes(
  app: FastifyInstance,
  service: BookmarkService,
): void {
  app.get("/api/tags", () => {
    return { tags: service.listTags() };
  });
}
