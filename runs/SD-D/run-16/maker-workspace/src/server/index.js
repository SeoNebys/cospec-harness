// Server entry point: start the HTTP server bound to 0.0.0.0:4000.
import { createApp } from './app.js';
import { getDb } from './db/connection.js';
import { config } from './config.js';

getDb(); // initialize DB + run migrations at startup
const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`Bookmark Manager listening on http://${config.host}:${config.port}`);
});
