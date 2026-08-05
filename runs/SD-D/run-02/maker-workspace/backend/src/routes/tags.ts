/**
 * Tag routes (FR-017/018): list/suggest existing tags for reuse while typing.
 * Per-bookmark tag edits go through PATCH /bookmarks/:id (tags array).
 */
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { suggestTags } from '../models/tag.js';

export function registerTags(fastify: FastifyInstance, db: Database.Database): void {
  fastify.get('/tags', async (req) => {
    const prefix = (req.query as { prefix?: string }).prefix ?? '';
    return { tags: suggestTags(db, prefix, 15) };
  });
}
