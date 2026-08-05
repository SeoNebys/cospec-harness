import { buildApp } from "../src/app.js";
import { openDb } from "../src/db/index.js";
import {
  createBookmarkService,
  type BookmarkService,
} from "../src/services/bookmarks.js";

export interface TestContext {
  app: ReturnType<typeof buildApp>;
  service: BookmarkService;
}

/**
 * Build an app backed by an in-memory DB. Title derivation is stubbed so tests
 * never hit the network; by default it returns null (→ URL fallback).
 */
export function makeTestApp(
  opts: {
    deriveTitle?: (url: string) => Promise<string | null>;
    undoWindowMs?: number;
    now?: () => number;
  } = {},
): TestContext {
  const db = openDb(":memory:");
  const service = createBookmarkService({
    db,
    undoWindowMs: opts.undoWindowMs ?? 30_000,
    deriveTitle: opts.deriveTitle ?? (async () => null),
    now: opts.now,
  });
  const app = buildApp({ service });
  return { app, service };
}
