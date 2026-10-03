import fs from "node:fs";
import path from "node:path";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import type { AppDatabase } from "./db/database.js";
import { type MetadataQueue, registerBookmarkRoutes } from "./routes/bookmarks.js";
import { registerHealthRoutes } from "./routes/health.js";
import { type MetadataPreviewer, registerMetadataRoutes } from "./routes/metadata.js";
import { registerSavedViewRoutes } from "./routes/saved-views.js";
import { registerSelectionRoutes } from "./routes/selections.js";
import { registerTagRoutes } from "./routes/tags.js";

export interface AppDependencies {
  config: AppConfig;
  database: AppDatabase;
  now?: () => Date;
  metadataQueue?: MetadataQueue;
  metadataPreviewer?: MetadataPreviewer;
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: dependencies.config.nodeEnv !== "test",
    bodyLimit: 512 * 1024,
  });
  app.setValidatorCompiler(TypeBoxValidatorCompiler);

  app.decorate("database", dependencies.database);
  app.decorate("now", dependencies.now ?? (() => new Date()));

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "no-referrer" },
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;

    const contentType = request.headers["content-type"];
    if (request.method !== "DELETE" && !contentType?.toLowerCase().startsWith("application/json")) {
      await reply.code(415).send({
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Mutation requests must use application/json.",
      });
      return;
    }

    const origin = request.headers.origin;
    if (origin) {
      const expected = `${request.protocol}://${request.headers.host}`;
      if (origin !== expected) {
        await reply.code(403).send({
          code: "ORIGIN_NOT_ALLOWED",
          message: "This request origin is not allowed.",
        });
      }
    }
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const validation = "validation" in error && Array.isArray(error.validation);
    const statusCode = validation
      ? 422
      : error.statusCode && error.statusCode >= 400
        ? error.statusCode
        : 500;
    reply.code(statusCode).send({
      code: validation
        ? "VALIDATION_ERROR"
        : statusCode >= 500
          ? "INTERNAL_ERROR"
          : "REQUEST_ERROR",
      message:
        statusCode >= 500
          ? "The request could not be completed."
          : validation
            ? "One or more request fields are invalid."
            : error.message,
    });
  });

  await registerHealthRoutes(app);
  await registerMetadataRoutes(app, dependencies.metadataPreviewer);
  await registerBookmarkRoutes(app, dependencies.metadataQueue);
  await registerTagRoutes(app);
  await registerSelectionRoutes(app);
  await registerSavedViewRoutes(app);

  if (fs.existsSync(path.join(dependencies.config.clientDirectory, "index.html"))) {
    await app.register(fastifyStatic, {
      root: dependencies.config.clientDirectory,
      prefix: "/",
      wildcard: false,
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ code: "NOT_FOUND", message: "Resource not found." });
      }
      return reply.type("text/html").sendFile("index.html");
    });
  } else {
    app.setNotFoundHandler(async (_request, reply) =>
      reply.code(404).send({ code: "NOT_FOUND", message: "Resource not found." }),
    );
  }

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    database: AppDatabase;
    now: () => Date;
  }
}
