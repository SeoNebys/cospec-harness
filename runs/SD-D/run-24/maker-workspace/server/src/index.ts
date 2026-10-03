import { HOST, PORT } from './config';
import { getDb } from './db/connection';
import { migrate } from './db/migrate';
import { createApp } from './app';

migrate(getDb());

const app = createApp();
app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});
