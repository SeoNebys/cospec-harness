import type { FastifyInstance } from "fastify";

import { TagSummaryListSchema } from "../../shared/contracts/api.js";
import { TagRepository } from "../repositories/tag-repository.js";

export async function registerTagRoutes(app: FastifyInstance): Promise<void> {
  const tags = new TagRepository(app.database);

  app.get("/api/tags", { schema: { response: { 200: TagSummaryListSchema } } }, async () =>
    tags.listSummaries(),
  );
}
