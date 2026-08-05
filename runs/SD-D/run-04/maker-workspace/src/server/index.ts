import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import { openDb, resolveDbPath } from './db/connection';
import { buildApp } from './app';

// Local app entry point. Opens the on-disk database, builds the API, and (in a
// built/production setup) serves the SPA so the person launches one thing.

const PORT = Number(process.env.PORT ?? 8787);
const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '../../dist');

async function main(): Promise<void> {
  const db = openDb(resolveDbPath());
  const app = buildApp({ db });

  // Serve the built SPA when it exists (after `npm run build`). In dev, Vite
  // serves the SPA on :5173 and proxies /api here, so this block is skipped.
  if (existsSync(distDir)) {
    await app.register(fastifyStatic, { root: distDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api')) {
        reply.status(404).send({ error: { code: 'not_found', message: 'Not found.' } });
      } else {
        reply.sendFile('index.html'); // SPA fallback
      }
    });
  }

  await app.listen({ port: PORT, host: '127.0.0.1' });
  console.log(`Bookmark Manager backend on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
