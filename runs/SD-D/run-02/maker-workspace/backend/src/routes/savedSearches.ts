/**
 * Saved-search routes (FR-033): save a named search, list, and remove.
 */
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

export function registerSavedSearches(fastify: FastifyInstance, db: Database.Database): void {
  fastify.get('/saved-searches', async () => ({
    savedSearches: db
      .prepare(`SELECT id, name, query, created_at FROM saved_searches ORDER BY created_at DESC`)
      .all(),
  }));

  fastify.post('/saved-searches', async (req, reply) => {
    const body = (req.body ?? {}) as { name?: string; query?: string };
    if (!body.name?.trim() || !body.query?.trim()) {
      return reply.code(400).send({ error: 'A name and a query are required.' });
    }
    const info = db
      .prepare(`INSERT INTO saved_searches (name, query, created_at) VALUES (?, ?, ?)`)
      .run(body.name.trim(), body.query.trim(), new Date().toISOString());
    const saved = db
      .prepare(`SELECT id, name, query, created_at FROM saved_searches WHERE id = ?`)
      .get(Number(info.lastInsertRowid));
    return reply.code(201).send({ savedSearch: saved });
  });

  fastify.delete('/saved-searches/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const info = db.prepare(`DELETE FROM saved_searches WHERE id = ?`).run(id);
    return info.changes > 0 ? reply.code(204).send() : reply.code(404).send({ error: 'Not found' });
  });
}
