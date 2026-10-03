import { createApp } from './app.js';
import { getDb } from './db.js';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

// Initialize storage up front so the schema exists before the first request.
getDb();

const app = createApp();

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});
