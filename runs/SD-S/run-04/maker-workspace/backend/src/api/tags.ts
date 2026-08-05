import type { FastifyInstance } from "fastify";
import type { TagService } from "../services/tagService.js";

/** Register tag endpoints (contracts/api.md). */
export function registerTagRoutes(app: FastifyInstance, tagService: TagService): void {
  app.get("/api/tags", (_req, reply) => {
    reply.send({ tags: tagService.listWithCounts() });
  });
}
