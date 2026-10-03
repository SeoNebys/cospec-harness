import { createApp } from './app.js';
import { getDb } from './db/index.js';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

// Ensure the database exists and is migrated before accepting traffic.
getDb();

const app = createApp();
app.listen(PORT, HOST, () => {
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});
