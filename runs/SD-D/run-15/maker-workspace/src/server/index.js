// T008: Server entry point. Initializes the DB (via import side-effect) and listens.
import './db/connection.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();
app.listen(PORT, HOST, () => {
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});
