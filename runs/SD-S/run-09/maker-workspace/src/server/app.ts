import fs from "node:fs";
import path from "node:path";
import Fastify, { LogController } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { createDatabase, type AppDatabase } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { createAuth } from "./auth/auth.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { protectApplicationMutation } from "./api/request-security.js";
import { errorHandler } from "./api/errors.js";
import { MemoryMailer, type Mailer } from "./mail/mailer.js";
import { ConsoleMailer } from "./mail/test-mailer.js";
import { SmtpMailer } from "./mail/smtp-mailer.js";
import { IconRepository } from "./repositories/icon-repository.js";
import { BookmarkRepository } from "./repositories/bookmark-repository.js";
import { OrganizationRepository } from "./repositories/organization-repository.js";
import { MetadataService } from "./metadata/metadata-service.js";
import { SafeHttpClient } from "./metadata/safe-http-client.js";
import { BookmarkService } from "./services/bookmark-service.js";
import { OrganizationService } from "./services/organization-service.js";
import { registerBookmarkRoutes } from "./api/bookmark-routes.js";
import { registerMetadataRoutes } from "./api/metadata-routes.js";
import { registerOrganizationRoutes } from "./api/organization-routes.js";

export type AppOptions = { config?: AppConfig; db?: AppDatabase; mailer?: Mailer; logger?: boolean };

export async function buildApp(options: AppOptions = {}) {
  const config = options.config ?? loadConfig();
  const db = options.db ?? createDatabase(config.databasePath);
  runMigrations(db);
  const app = Fastify({
    logger: options.logger ?? config.nodeEnv !== "test",
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 1_000_000
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.nodeEnv === "production" ? [] : null
      }
    },
    hsts: config.nodeEnv === "production",
    crossOriginEmbedderPolicy: false
  });
  app.setErrorHandler(errorHandler);
  app.addHook("preHandler", protectApplicationMutation(config));

  const mailer = options.mailer ?? (config.mailTransport === "smtp" ? new SmtpMailer(config) : config.mailTransport === "memory" ? new MemoryMailer() : new ConsoleMailer());
  const auth = createAuth(db, config, mailer);
  const icons = new IconRepository(db);
  const bookmarkRepository = new BookmarkRepository(db);
  const organizationRepository = new OrganizationRepository(db);
  const metadata = new MetadataService(new SafeHttpClient(), icons, config);
  const bookmarkService = new BookmarkService(bookmarkRepository, icons, metadata, config);
  const organizationService = new OrganizationService(organizationRepository);

  registerAuthRoutes(app, auth);
  registerBookmarkRoutes(app, auth, bookmarkRepository, icons, bookmarkService);
  registerMetadataRoutes(app, auth, metadata, bookmarkService);
  registerOrganizationRoutes(app, auth, organizationRepository, organizationService);

  app.get("/api/health", async () => ({ status: "ok" }));
  const clientRoot = path.resolve("dist/client");
  if (fs.existsSync(clientRoot)) {
    await app.register(fastifyStatic, { root: clientRoot, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) return reply.status(404).send({ code: "NOT_FOUND", message: "Not found" });
      return reply.sendFile("index.html");
    });
  }
  app.addHook("onClose", async () => { if (!options.db) db.close(); });

  const pending = bookmarkRepository.stalePending()[0];
  if (pending) void metadata.enrichBookmark(bookmarkRepository, pending.userId, pending.id, pending.url);
  return app;
}
