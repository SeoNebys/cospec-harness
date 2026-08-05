import Fastify, { type FastifyInstance } from "fastify";
import { AppError } from "./errors.js";
import { registerBookmarkRoutes } from "./routes/bookmarks.js";
import { registerTagRoutes } from "./routes/tags.js";
import type { BookmarkService } from "./services/bookmarks.js";

export interface BuildAppOptions {
  service: BookmarkService;
  logger?: boolean;
}

/** Build a Fastify app wired to a bookmark service. Used by both server and tests. */
export function buildApp(opts: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });

  registerBookmarkRoutes(app, opts.service);
  registerTagRoutes(app, opts.service);

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply
        .code(error.status)
        .send({ error: error.code, message: error.message, ...error.details });
    }
    reply.log.error(error);
    return reply
      .code(500)
      .send({ error: "internal_error", message: "An unexpected error occurred." });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: "not_found", message: "Resource not found." });
  });

  return app;
}
