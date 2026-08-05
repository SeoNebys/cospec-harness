/**
 * Import/export routes (FR-030/031/032). Import a Netscape bookmarks file with
 * normalize + dedupe; reject malformed files; export the whole collection.
 */
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { InvalidUrlError, fallbackTitle, normalizeUrl } from '../services/url.js';
import {
  MalformedImportError,
  parseNetscapeBookmarks,
  toNetscapeBookmarks,
} from '../services/importer.js';
import * as Bookmarks from '../models/bookmark.js';

export function registerImportExport(fastify: FastifyInstance, db: Database.Database): void {
  // Accepts either a multipart file upload or a raw text body { content }.
  fastify.post('/import', async (req, reply) => {
    let content = '';
    try {
      if (typeof (req as any).file === 'function') {
        const file = await (req as any).file();
        if (file) content = (await file.toBuffer()).toString('utf-8');
      }
    } catch {
      /* fall through to body */
    }
    if (!content) {
      const body = (req.body ?? {}) as { content?: string };
      content = body.content ?? '';
    }

    let entries;
    try {
      entries = parseNetscapeBookmarks(content);
    } catch (e) {
      if (e instanceof MalformedImportError) return reply.code(400).send({ error: e.message });
      throw e;
    }

    let added = 0;
    let duplicates = 0;
    const now = new Date().toISOString();
    for (const entry of entries) {
      let norm;
      try {
        norm = normalizeUrl(entry.url);
      } catch (e) {
        if (e instanceof InvalidUrlError) continue;
        throw e;
      }
      if (Bookmarks.findByNormalized(db, norm.normalized)) {
        duplicates++;
        continue;
      }
      Bookmarks.create(db, {
        url: norm.href,
        normalized_url: norm.normalized,
        title: entry.title || fallbackTitle(norm.href),
        tags: entry.tags,
        now,
      });
      added++;
    }
    return { added, duplicates, total: entries.length };
  });

  fastify.get('/export', async (_req, reply) => {
    const all = Bookmarks.list(db, { archived: false }).concat(Bookmarks.list(db, { archived: true }));
    const doc = toNetscapeBookmarks(
      all.map((b) => ({ url: b.url, title: b.title, tags: b.tags, created_at: b.created_at }))
    );
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="bookmarks.html"');
    return reply.send(doc);
  });
}
