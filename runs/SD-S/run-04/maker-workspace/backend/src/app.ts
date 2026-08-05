import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type BetterSqlite3 from "better-sqlite3";
import { registerErrorHandler } from "./api/errors.js";
import { registerBookmarkRoutes } from "./api/bookmarks.js";
import { registerTagRoutes } from "./api/tags.js";
import { createTagService, type TagService } from "./services/tagService.js";
import { createBookmarkService, type BookmarkService } from "./services/bookmarkService.js";
import { fetchMetadata, type MetadataFetcher } from "./services/metadataFetcher.js";

export interface AppServices {
  tagService: TagService;
  bookmarkService: BookmarkService;
}

export interface BuildAppOptions {
  db: BetterSqlite3.Database;
  /** Override metadata fetching (tests inject a stub). */
  fetchMetadata?: MetadataFetcher;
  /** Override enrichment scheduling (tests can run it synchronously). */
  scheduleEnrich?: (fn: () => void) => void;
  now?: () => string;
  logger?: boolean;
}

export function createServices(opts: BuildAppOptions): AppServices {
  const tagService = createTagService(opts.db);
  const bookmarkService = createBookmarkService({
    db: opts.db,
    tagService,
    fetchMetadata: opts.fetchMetadata ?? fetchMetadata,
    now: opts.now,
  });
  return { tagService, bookmarkService };
}

/** Build the Fastify app with all routes wired to the given database. */
export async function buildApp(
  opts: BuildAppOptions,
): Promise<{ app: FastifyInstance; services: AppServices }> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: true });
  registerErrorHandler(app);

  const services = createServices(opts);
  const scheduleEnrich = opts.scheduleEnrich ?? ((fn: () => void) => setImmediate(fn));

  registerBookmarkRoutes(app, services.bookmarkService, scheduleEnrich);
  registerTagRoutes(app, services.tagService);

  app.get("/api/health", (_req, reply) => reply.send({ ok: true }));

  return { app, services };
}
