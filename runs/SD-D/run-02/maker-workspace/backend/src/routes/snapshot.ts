/**
 * Snapshot route (FR-026/027): serve a bookmark's stored snapshot — the readable
 * page (HTML) or the original PDF — or report it as unavailable.
 */
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { createReadStream, existsSync } from 'node:fs';
import * as Snapshots from '../models/snapshot.js';

export function registerSnapshot(fastify: FastifyInstance, db: Database.Database): void {
  fastify.get('/bookmarks/:id/snapshot', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const snap = Snapshots.get(db, id);
    if (!snap || snap.status !== 'available' || !snap.stored_path || !existsSync(snap.stored_path)) {
      return reply.code(404).send({ error: 'No snapshot available for this bookmark.', status: snap?.status ?? 'unavailable' });
    }
    reply.header('Content-Type', snap.kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8');
    return reply.send(createReadStream(snap.stored_path));
  });

  // Lightweight status (used by the UI to show snapshot availability + archive link).
  fastify.get('/bookmarks/:id/snapshot/status', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const snap = Snapshots.get(db, id);
    return {
      status: snap?.status ?? 'pending',
      kind: snap?.kind ?? null,
      archive_url: snap?.archive_url ?? null,
    };
  });
}
