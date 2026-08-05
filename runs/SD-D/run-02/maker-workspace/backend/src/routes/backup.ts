/**
 * Complete backup & restore (FR-036, SC-009). Produces a single portable JSON file
 * containing links, titles, descriptions, notes, tags, read/archive state, saved
 * searches, and preferences — everything needed to move to another computer with no
 * data loss. (Snapshot payloads live under data/snapshots/; copying the data/ folder
 * is the belt-and-braces option and is documented in the README.)
 */
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { InvalidUrlError, normalizeUrl } from '../services/url.js';
import * as Bookmarks from '../models/bookmark.js';
import { getPreferences } from './preferences.js';

const BACKUP_VERSION = 1;

export function registerBackup(fastify: FastifyInstance, db: Database.Database): void {
  fastify.get('/backup', async (_req, reply) => {
    const bookmarks = Bookmarks.list(db, { archived: false })
      .concat(Bookmarks.list(db, { archived: true }))
      .map((b) => ({
        url: b.url,
        title: b.title,
        description: b.description,
        notes: b.notes,
        tags: b.tags,
        read_state: b.read_state,
        archived: b.archived,
        created_at: b.created_at,
      }));
    const savedSearches = db.prepare(`SELECT name, query, created_at FROM saved_searches`).all();
    const backup = {
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      preferences: getPreferences(db),
      bookmarks,
      savedSearches,
    };
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="bookmark-backup.json"');
    return reply.send(JSON.stringify(backup, null, 2));
  });

  fastify.post('/restore', async (req, reply) => {
    const body = (req.body ?? {}) as any;
    if (!body || body.version !== BACKUP_VERSION || !Array.isArray(body.bookmarks)) {
      return reply.code(400).send({ error: 'This is not a valid backup file.' });
    }

    let restored = 0;
    let skipped = 0;
    for (const b of body.bookmarks) {
      let norm;
      try {
        norm = normalizeUrl(String(b.url ?? ''));
      } catch (e) {
        if (e instanceof InvalidUrlError) { skipped++; continue; }
        throw e;
      }
      if (Bookmarks.findByNormalized(db, norm.normalized)) { skipped++; continue; }
      const created = Bookmarks.create(db, {
        url: norm.href,
        normalized_url: norm.normalized,
        title: String(b.title ?? ''),
        description: String(b.description ?? ''),
        notes: String(b.notes ?? ''),
        tags: Array.isArray(b.tags) ? b.tags : [],
        read_state: b.read_state === 'to_read' ? 'to_read' : 'read',
        now: typeof b.created_at === 'string' ? b.created_at : new Date().toISOString(),
      });
      if (b.archived) Bookmarks.update(db, created.id, { archived: true }, created.created_at);
      restored++;
    }

    if (Array.isArray(body.savedSearches)) {
      const ins = db.prepare(`INSERT INTO saved_searches (name, query, created_at) VALUES (?, ?, ?)`);
      for (const s of body.savedSearches) {
        if (s?.name && s?.query) ins.run(s.name, s.query, s.created_at ?? new Date().toISOString());
      }
    }
    if (body.preferences) {
      const p = body.preferences;
      db.prepare(`UPDATE preferences SET default_sort=?, text_size=?, archive_optin=? WHERE id=1`).run(
        ['newest', 'oldest', 'title'].includes(p.default_sort) ? p.default_sort : 'newest',
        ['normal', 'large'].includes(p.text_size) ? p.text_size : 'normal',
        p.archive_optin ? 1 : 0
      );
    }

    return { restored, skipped };
  });
}
