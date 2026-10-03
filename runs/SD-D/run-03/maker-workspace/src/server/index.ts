import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { closeDatabase, openDatabase } from "./db/database.js";
import { runMigrations } from "./db/migrate.js";
import { MetadataCoordinator } from "./services/metadata/metadata-coordinator.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
runMigrations(database);

const metadata = new MetadataCoordinator({ database, config: config.metadata });
metadata.start();
const app = await buildApp({
  config,
  database,
  metadataQueue: metadata,
  metadataPreviewer: metadata,
});

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Shutting down");
  await app.close();
  await metadata.drain();
  closeDatabase(database);
}

let shuttingDown = false;

function requestShutdown(signal: string): void {
  void shutdown(signal).catch((error: unknown) => {
    app.log.error(error, "Graceful shutdown failed");
    process.exitCode = 1;
  });
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await metadata.drain();
  await app.close();
  closeDatabase(database);
  process.exitCode = 1;
}
