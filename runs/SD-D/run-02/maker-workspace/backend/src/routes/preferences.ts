/**
 * Preferences routes (FR-034) + shared accessor. Single-row settings remembered
 * across sessions: default sort, text size, and the archive opt-in (FR-027a).
 */
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

export interface Preferences {
  default_sort: 'newest' | 'oldest' | 'title';
  text_size: 'normal' | 'large';
  archive_optin: boolean;
}

interface Row {
  default_sort: 'newest' | 'oldest' | 'title';
  text_size: 'normal' | 'large';
  archive_optin: number;
}

export function getPreferences(db: Database.Database): Preferences {
  const row = db.prepare(`SELECT * FROM preferences WHERE id = 1`).get() as Row;
  return { ...row, archive_optin: !!row.archive_optin };
}

export function registerPreferences(fastify: FastifyInstance, db: Database.Database): void {
  fastify.get('/preferences', async () => ({ preferences: getPreferences(db) }));

  fastify.patch('/preferences', async (req, reply) => {
    const body = (req.body ?? {}) as Partial<Record<string, unknown>>;
    const cols: string[] = [];
    const params: Record<string, unknown> = {};
    if (body.default_sort === 'newest' || body.default_sort === 'oldest' || body.default_sort === 'title') {
      cols.push('default_sort = @default_sort');
      params.default_sort = body.default_sort;
    }
    if (body.text_size === 'normal' || body.text_size === 'large') {
      cols.push('text_size = @text_size');
      params.text_size = body.text_size;
    }
    if (typeof body.archive_optin === 'boolean') {
      cols.push('archive_optin = @archive_optin');
      params.archive_optin = body.archive_optin ? 1 : 0;
    }
    if (!cols.length) return reply.code(400).send({ error: 'No valid preference fields.' });
    db.prepare(`UPDATE preferences SET ${cols.join(', ')} WHERE id = 1`).run(params);
    return { preferences: getPreferences(db) };
  });
}
