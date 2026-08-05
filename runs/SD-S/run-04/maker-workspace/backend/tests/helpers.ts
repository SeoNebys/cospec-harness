import { createDatabase } from "../src/db/connection.js";
import { buildApp, type AppServices } from "../src/app.js";
import type { PageMetadata } from "../src/services/metadataFetcher.js";
import type { FastifyInstance } from "fastify";

export interface TestContext {
  app: FastifyInstance;
  services: AppServices;
  close: () => Promise<void>;
}

/**
 * Build an app backed by an in-memory DB with a stub metadata fetcher and no
 * automatic background enrichment (so tests control timing explicitly).
 */
export async function makeTestApp(metadata?: Partial<PageMetadata>): Promise<TestContext> {
  const db = createDatabase(":memory:");
  const fetchMetadata = async (): Promise<PageMetadata> => ({
    title: metadata?.title ?? null,
    description: metadata?.description ?? null,
    imageUrl: metadata?.imageUrl ?? null,
  });
  const { app, services } = await buildApp({
    db,
    fetchMetadata,
    scheduleEnrich: () => {}, // disable auto-enrichment; call services.enrich manually
  });
  return {
    app,
    services,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}
