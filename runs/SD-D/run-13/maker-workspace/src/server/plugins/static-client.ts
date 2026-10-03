import staticPlugin from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export async function registerStaticClient(app: FastifyInstance): Promise<void> {
  const root = resolve(process.cwd(), 'dist/client');
  if (!existsSync(root)) return;
  await app.register(staticPlugin, { root, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Resource not found.' });
    return reply.sendFile('index.html');
  });
}
