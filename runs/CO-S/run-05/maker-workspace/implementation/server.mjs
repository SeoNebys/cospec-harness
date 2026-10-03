import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpServer } from './app.mjs';
import { createStore } from './lib/store.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(root, 'data');
mkdirSync(dataDirectory, { recursive: true });

const store = createStore(resolve(dataDirectory, 'bookmarks.db'));
const server = createHttpServer({ store });
const port = Number(process.env.PORT || 4000);

server.listen(port, '0.0.0.0', () => {
  console.log(`Nest is listening on http://0.0.0.0:${port}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
