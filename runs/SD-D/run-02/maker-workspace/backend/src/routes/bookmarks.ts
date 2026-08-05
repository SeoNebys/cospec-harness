/**
 * Bookmark routes: create (with dedupe-redirect + async enrich), get, list,
 * edit, delete, and bulk actions. Serves US1, US2, US5, US6, US7, US9.
 */
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { InvalidUrlError, normalizeUrl, fallbackTitle } from '../services/url.js';
import { searchIds } from '../services/search.js';
import { enrichBookmark } from '../services/enrich.js';
import * as Bookmarks from '../models/bookmark.js';
import * as Tags from '../models/tag.js';
import { getPreferences } from './preferences.js';

type Enricher = (db: Database.Database, id: number, url: string, optin: boolean, userTitle: boolean, userDesc: boolean) => void;

// Indirection so tests can disable network enrichment.
const defaultEnricher: Enricher = (db, id, url, optin, userTitle, userDesc) => {
  void enrichBookmark(db, id, url, {
    userProvided: { title: userTitle, description: userDesc },
    archiveOptin: optin,
  });
};

export function registerBookmarks(
  fastify: FastifyInstance,
  db: Database.Database,
  enrich: Enricher = defaultEnricher
): void {
  // Create (FR-001..006)
  fastify.post('/bookmarks', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    let norm;
    try {
      norm = normalizeUrl(String(body.url ?? ''));
    } catch (e) {
      if (e instanceof InvalidUrlError) return reply.code(400).send({ error: e.message });
      throw e;
    }

    const existing = Bookmarks.findByNormalized(db, norm.normalized);
    if (existing) return reply.code(200).send({ bookmark: existing, deduped: true });

    const userTitle = typeof body.title === 'string' && body.title.trim().length > 0;
    const userDesc = typeof body.description === 'string' && (body.description as string).length > 0;
    const created = Bookmarks.create(db, {
      url: norm.href,
      normalized_url: norm.normalized,
      title: userTitle ? String(body.title).trim() : fallbackTitle(norm.href),
      description: userDesc ? String(body.description) : '',
      notes: typeof body.notes === 'string' ? body.notes : '',
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
      read_state: body.read_state === 'to_read' ? 'to_read' : 'read',
      now: new Date().toISOString(),
    });

    const prefs = getPreferences(db);
    enrich(db, created.id, norm.href, prefs.archive_optin, userTitle, userDesc);

    return reply.code(201).send({ bookmark: created, deduped: false });
  });

  // List (FR-009/011/016) — supports sort, read_state, archived, tag, and q (search).
  fastify.get('/bookmarks', async (req) => {
    const qs = req.query as Record<string, string | undefined>;
    const archived = qs.archived === 'true';
    const prefs = getPreferences(db);
    const sort = (qs.sort as 'newest' | 'oldest' | 'title') || prefs.default_sort;

    if (qs.q && qs.q.trim()) {
      const ids = searchIds(db, qs.q, archived);
      if (!ids.length) return { bookmarks: [] };
      const found = Bookmarks.list(db, { archived, ids, read_state: qs.read_state as any, tag: qs.tag });
      // Preserve search relevance order.
      const order = new Map(ids.map((id, i) => [id, i]));
      found.sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
      return { bookmarks: found };
    }

    return {
      bookmarks: Bookmarks.list(db, {
        sort,
        archived,
        read_state: qs.read_state as 'to_read' | 'read' | undefined,
        tag: qs.tag,
      }),
    };
  });

  // Get one
  fastify.get('/bookmarks/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const bm = Bookmarks.getById(db, id);
    return bm ? { bookmark: bm } : reply.code(404).send({ error: 'Not found' });
  });

  // Edit (FR-019/020/022/024)
  fastify.patch('/bookmarks/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const fields: Bookmarks.UpdateFields = {};

    if (typeof body.title === 'string') fields.title = body.title;
    if (typeof body.description === 'string') fields.description = body.description;
    if (typeof body.notes === 'string') fields.notes = body.notes;
    if (Array.isArray(body.tags)) fields.tags = body.tags as string[];
    if (body.read_state === 'to_read' || body.read_state === 'read') fields.read_state = body.read_state;
    if (typeof body.archived === 'boolean') fields.archived = body.archived;
    if (typeof body.url === 'string') {
      try {
        const norm = normalizeUrl(body.url);
        fields.url = norm.href;
        fields.normalized_url = norm.normalized;
      } catch (e) {
        if (e instanceof InvalidUrlError) return reply.code(400).send({ error: e.message });
        throw e;
      }
    }

    const updated = Bookmarks.update(db, id, fields, new Date().toISOString());
    return updated ? { bookmark: updated } : reply.code(404).send({ error: 'Not found' });
  });

  // Delete (FR-021)
  fastify.delete('/bookmarks/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    return Bookmarks.remove(db, id)
      ? reply.code(204).send()
      : reply.code(404).send({ error: 'Not found' });
  });

  // Bulk actions (FR-028/029)
  fastify.post('/bookmarks/bulk', async (req, reply) => {
    const body = (req.body ?? {}) as {
      ids?: number[];
      matchQuery?: string;
      archivedScope?: boolean;
      action?: string;
      tag?: string;
    };
    const scope = !!body.archivedScope;
    let ids = Array.isArray(body.ids) ? body.ids : [];
    if (body.matchQuery) ids = searchIds(db, body.matchQuery, scope); // "select all matching" (FR-028)
    if (!ids.length) return reply.code(400).send({ error: 'No bookmarks selected.' });

    const now = new Date().toISOString();
    switch (body.action) {
      case 'add-tag':
        if (!body.tag) return reply.code(400).send({ error: 'A tag is required.' });
        for (const id of ids) { Tags.addTag(db, id, body.tag); Bookmarks.update(db, id, {}, now); }
        break;
      case 'remove-tag':
        if (!body.tag) return reply.code(400).send({ error: 'A tag is required.' });
        for (const id of ids) { Tags.removeTag(db, id, body.tag); Bookmarks.update(db, id, {}, now); }
        break;
      case 'mark-read':
        for (const id of ids) Bookmarks.update(db, id, { read_state: 'read' }, now);
        break;
      case 'mark-to-read':
        for (const id of ids) Bookmarks.update(db, id, { read_state: 'to_read' }, now);
        break;
      case 'archive':
        for (const id of ids) Bookmarks.update(db, id, { archived: true }, now);
        break;
      case 'unarchive':
        for (const id of ids) Bookmarks.update(db, id, { archived: false }, now);
        break;
      case 'delete':
        for (const id of ids) Bookmarks.remove(db, id);
        break;
      default:
        return reply.code(400).send({ error: `Unknown action: ${body.action}` });
    }
    return { affected: ids.length };
  });
}
