import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { z } from 'zod';
import type { DB } from '../db/db.ts';
import type { CaptureQueue } from '../services/captureQueue.ts';
import { notFound } from '../lib/errors.ts';
import * as Bookmark from '../models/bookmark.ts';
import { setBookmarkTags, getBookmarkTags } from '../models/tag.ts';
import { getPreferences } from '../models/preferences.ts';
import { resolveView, orderByClause, type Scope } from '../services/search/resolveView.ts';
import { submitToArchiveOrg } from '../services/archiveOrg.ts';

const SCOPES = ['active', 'unread', 'archived', 'all'] as const;

function asArray(v: unknown): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

const createSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
  unread: z.boolean().optional(),
});

const patchSchema = z.object({
  url: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  unread: z.boolean().optional(),
  archived: z.boolean().optional(),
});

const bulkSchema = z.object({
  selector: z.union([
    z.object({ ids: z.array(z.string()).min(1) }),
    z.object({
      match: z.object({
        q: z.string().optional(),
        tag: z.union([z.string(), z.array(z.string())]).optional(),
        view: z.number().optional(),
        scope: z.enum(SCOPES).optional(),
      }),
    }),
  ]),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('addTags'), tags: z.array(z.string()).min(1) }),
    z.object({ type: z.literal('removeTags'), tags: z.array(z.string()).min(1) }),
    z.object({ type: z.literal('setUnread'), unread: z.boolean() }),
    z.object({ type: z.literal('archive'), archived: z.boolean() }),
    z.object({ type: z.literal('delete') }),
  ]),
});

export function registerBookmarkRoutes(
  app: FastifyInstance,
  db: DB,
  queue: CaptureQueue,
): void {
  // List / search.
  app.get('/api/bookmarks', async (req) => {
    const qp = req.query as Record<string, unknown>;
    const prefs = getPreferences(db);
    const scope = (SCOPES as readonly string[]).includes(String(qp.scope))
      ? (qp.scope as Scope)
      : 'active';
    const view = qp.view != null && qp.view !== '' ? Number(qp.view) : undefined;
    const where = resolveView(db, {
      q: qp.q ? String(qp.q) : undefined,
      tags: asArray(qp.tag),
      view: Number.isFinite(view) ? view : undefined,
      scope,
    });
    const sort = qp.sort ? String(qp.sort) : prefs.defaultSort;
    const orderBy = orderByClause(sort, prefs.defaultSort);
    const page = Math.max(1, Number(qp.page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(qp.pageSize) || prefs.itemsShown));

    const total = (
      db.prepare(`SELECT COUNT(*) AS n FROM bookmark b WHERE ${where.sql}`).get(...where.params) as {
        n: number;
      }
    ).n;
    const rows = db
      .prepare(
        `SELECT b.rowid, b.* FROM bookmark b WHERE ${where.sql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      )
      .all(...where.params, pageSize, (page - 1) * pageSize) as never[];
    return {
      items: rows.map((r) => Bookmark.serialize(db, r)),
      total,
      page,
      pageSize,
    };
  });

  // Create.
  app.post('/api/bookmarks', async (req, reply) => {
    const body = createSchema.parse(req.body);
    const created = Bookmark.create(db, body);
    queue.enqueue({ id: created.id, url: created.url });
    reply.code(201);
    return created;
  });

  // Read one.
  app.get('/api/bookmarks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const b = Bookmark.getById(db, id);
    if (!b) throw notFound('Bookmark not found.');
    return b;
  });

  // Update.
  app.patch('/api/bookmarks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const patch = patchSchema.parse(req.body);
    const updated = Bookmark.update(db, id, patch);
    if (!updated) throw notFound('Bookmark not found.');
    return updated;
  });

  // Delete (permanent).
  app.delete('/api/bookmarks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = Bookmark.remove(db, id);
    if (!ok) throw notFound('Bookmark not found.');
    reply.code(204);
    return null;
  });

  // Bulk actions.
  app.post('/api/bookmarks/bulk', async (req) => {
    const { selector, action } = bulkSchema.parse(req.body);

    let ids: string[];
    if ('ids' in selector) {
      ids = selector.ids;
    } else {
      const m = selector.match;
      const view = m.view != null ? Number(m.view) : undefined;
      const where = resolveView(db, {
        q: m.q,
        tags: asArray(m.tag),
        view,
        scope: m.scope ?? 'active',
      });
      const rows = db
        .prepare(`SELECT b.id FROM bookmark b WHERE ${where.sql}`)
        .all(...where.params) as { id: string }[];
      ids = rows.map((r) => r.id);
    }

    let affected = 0;
    const runAll = db.transaction((targetIds: string[]) => {
      for (const id of targetIds) {
        const existing = Bookmark.getById(db, id);
        if (!existing) continue;
        switch (action.type) {
          case 'addTags': {
            const union = Array.from(new Set([...existing.tags, ...action.tags]));
            setBookmarkTags(db, id, union);
            break;
          }
          case 'removeTags': {
            const remove = new Set(action.tags.map((t) => t.trim().toLowerCase()));
            const kept = getBookmarkTags(db, id).filter((t) => !remove.has(t));
            setBookmarkTags(db, id, kept);
            break;
          }
          case 'setUnread':
            Bookmark.update(db, id, { unread: action.unread });
            break;
          case 'archive':
            Bookmark.update(db, id, { archived: action.archived });
            break;
          case 'delete':
            Bookmark.remove(db, id);
            break;
        }
        affected++;
      }
    });
    runAll(ids);
    return { affected };
  });

  // Internet Archive submission (best-effort).
  app.post('/api/bookmarks/:id/archive-org', async (req) => {
    const { id } = req.params as { id: string };
    const b = Bookmark.getById(db, id);
    if (!b) throw notFound('Bookmark not found.');
    const archivedUrl = await submitToArchiveOrg(b.url); // throws 502 on failure
    Bookmark.setArchiveOrgUrl(db, id, archivedUrl);
    return { archiveOrgUrl: archivedUrl };
  });

  // Serve the preserved copy.
  app.get('/api/bookmarks/:id/snapshot', async (req, reply) => {
    const { id } = req.params as { id: string };
    const info = Bookmark.getSnapshotInfo(db, id);
    if (!info) throw notFound('No preserved copy is available for this bookmark yet.');
    reply.type(info.kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8');
    return reply.send(createReadStream(info.path));
  });
}
