import { migrate } from './db/migrations.js';
import { createApp } from './app.js';

migrate();

const app = createApp();
const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});
