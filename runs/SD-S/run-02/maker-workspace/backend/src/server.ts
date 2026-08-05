import { buildApp } from "./app.js";
import { config } from "./config.js";
import { openDb } from "./db/index.js";
import { createBookmarkService } from "./services/bookmarks.js";

async function main() {
  const db = openDb(config.dbPath);
  const service = createBookmarkService({
    db,
    undoWindowMs: config.undoWindowMs,
  });

  // Periodically purge soft-deleted bookmarks whose undo window has elapsed.
  const purgeTimer = setInterval(
    () => service.purgeExpired(),
    Math.max(1_000, Math.floor(config.undoWindowMs / 2)),
  );
  purgeTimer.unref();

  const app = buildApp({ service, logger: true });

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    app.log.info(`Bookmark Manager API listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
