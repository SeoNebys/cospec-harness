/**
 * Search route (FR-013/014/015/016). Full-text search across title/url/description/
 * notes/tags with AND/OR/NOT/grouping/phrase and inline tag: terms. Excludes
 * archived unless scoped to the archive.
 */
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { searchIds } from '../services/search.js';
import * as Bookmarks from '../models/bookmark.js';

export function registerSearch(fastify: FastifyInstance, db: Database.Database): void {
  fastify.get('/search', async (req) => {
    const qs = req.query as { q?: string; archived?: string };
    const archived = qs.archived === 'true';
    const ids = searchIds(db, qs.q ?? '', archived);
    if (!ids.length) return { bookmarks: [] };
    const found = Bookmarks.list(db, { archived, ids });
    const order = new Map(ids.map((id, i) => [id, i]));
    found.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return { bookmarks: found };
  });
}
