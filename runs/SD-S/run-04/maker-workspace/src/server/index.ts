import { loadConfig } from './config.js';
import { migrate, openDatabase } from './db/index.js';
import { createApp } from './app.js';

const config = loadConfig();
const database = openDatabase(config.databasePath);
migrate(database);
const server = createApp(database, config).listen(config.port, config.host, () =>
  console.info(`Keepsake listening on http://${config.host}:${config.port}`),
);

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
