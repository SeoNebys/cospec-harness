import type { FastifyInstance } from 'fastify';
import type { DB } from '../db/connection';
import type { EnrichFn } from '../app';
import type { CreateBookmarkInput, SortOrder, TagFilter, View } from '../../shared/types';
import {
  createBookmark,
  getById,
  listBookmarks,
  updateBookmark,
  deleteBookmark,
  batchAction,
  type BatchAction,
} from '../db/queries';
import { InvalidUrlError } from '../services/url';
import { exportCollection, importCollection, InvalidImportError } from '../services/backup';

/** Normalize a query param that may be absent, a single string, or repeated. */
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v.length) return [v];
  return [];
}

function parseFilter(q: Record<string, unknown>): TagFilter {
  const views: View[] = ['all', 'readLater', 'archived'];
  const sorts: SortOrder[] = ['newest', 'oldest', 'title'];
  const view =
    typeof q.view === 'string' && views.includes(q.view as View) ? (q.view as View) : 'all';
  const sort =
    typeof q.sort === 'string' && sorts.includes(q.sort as SortOrder)
      ? (q.sort as SortOrder)
      : 'newest';
  return {
    text: typeof q.text === 'string' ? q.text : undefined,
    tagsAny: asArray(q.tagsAny),
    tagsAll: asArray(q.tagsAll),
    tagsNot: asArray(q.tagsNot),
    view,
    sort,
  };
}

// Bookmark routes. US1 MVP scope: list (newest-first), create (with dedupe +
// background enrichment), get-by-id. PATCH/DELETE/batch/search arrive in US2/US3.

export function registerBookmarkRoutes(app: FastifyInstance, db: DB, enrich: EnrichFn): void {
  // GET /api/bookmarks — list/search with the filter model (contracts/filter-model.md).
  app.get('/bookmarks', async (req) => {
    const filter = parseFilter((req.query ?? {}) as Record<string, unknown>);
    const bookmarks = listBookmarks(db, filter);
    return { bookmarks, total: bookmarks.length };
  });

  // POST /api/bookmarks — create; dedupe returns the existing one (FR-023).
  app.post('/bookmarks', async (req, reply) => {
    const body = (req.body ?? {}) as CreateBookmarkInput;
    if (typeof body.url !== 'string') {
      return reply
        .status(400)
        .send({ error: { code: 'invalid_url', message: 'A web address is required.' } });
    }

    let result;
    try {
      result = createBookmark(db, body);
    } catch (err) {
      if (err instanceof InvalidUrlError) {
        return reply.status(400).send({ error: { code: 'invalid_url', message: err.message } });
      }
      throw err;
    }

    if (result.existing) {
      // Not a dead end: hand back the existing bookmark so the UI opens it for editing.
      return reply.status(200).send({ bookmark: result.bookmark, existing: true });
    }

    // Enrich in the background; the save itself already succeeded (FR-005, SC-001).
    void enrich(db, result.bookmark.id, result.bookmark.url);
    return reply.status(201).send({ bookmark: result.bookmark, existing: false });
  });

  // PATCH /api/bookmarks/:id — edit address/title/description/notes/tags + flags
  // (FR-003/FR-006/FR-013/FR-015/FR-016). Editing the address into another
  // bookmark's returns 409 with the existing one (FR-023).
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/bookmarks/:id',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || !getById(db, id)) {
        return reply
          .status(404)
          .send({ error: { code: 'not_found', message: 'Bookmark not found.' } });
      }
      const body = req.body ?? {};
      const patch: Record<string, unknown> = {};
      if (typeof body.url === 'string') patch.url = body.url;
      if (typeof body.title === 'string') patch.title = body.title;
      if (typeof body.description === 'string') patch.description = body.description;
      if (typeof body.notes === 'string') patch.notes = body.notes;
      if (typeof body.readLater === 'boolean') patch.readLater = body.readLater;
      if (typeof body.archived === 'boolean') patch.archived = body.archived;
      if (Array.isArray(body.tags))
        patch.tags = body.tags.filter((t): t is string => typeof t === 'string');

      let result;
      try {
        result = updateBookmark(db, id, patch);
      } catch (err) {
        if (err instanceof InvalidUrlError) {
          return reply.status(400).send({ error: { code: 'invalid_url', message: err.message } });
        }
        throw err;
      }
      if (!result.ok && result.reason === 'not_found') {
        return reply
          .status(404)
          .send({ error: { code: 'not_found', message: 'Bookmark not found.' } });
      }
      if (!result.ok && result.reason === 'duplicate_url') {
        return reply.status(409).send({
          error: { code: 'duplicate_url', message: 'That address is already saved.' },
          existing: result.existing,
        });
      }
      return { bookmark: (result as { bookmark: unknown }).bookmark };
    }
  );

  // DELETE /api/bookmarks/:id — permanent removal (FR-017; confirmation is UI-side).
  app.delete<{ Params: { id: string } }>('/bookmarks/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || !deleteBookmark(db, id)) {
      return reply
        .status(404)
        .send({ error: { code: 'not_found', message: 'Bookmark not found.' } });
    }
    return reply.status(204).send();
  });

  // POST /api/bookmarks/batch — one action over many ids (FR-019/FR-020).
  app.post<{ Body: { ids?: unknown; action?: unknown; tag?: unknown } }>(
    '/bookmarks/batch',
    async (req, reply) => {
      const body = req.body ?? {};
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((n): n is number => typeof n === 'number')
        : [];
      const actions: BatchAction[] = ['addTag', 'archive', 'unarchive', 'delete'];
      const action = actions.includes(body.action as BatchAction)
        ? (body.action as BatchAction)
        : null;
      if (!action) {
        return reply
          .status(400)
          .send({ error: { code: 'invalid_action', message: 'Unknown batch action.' } });
      }
      if (action === 'addTag' && typeof body.tag !== 'string') {
        return reply
          .status(400)
          .send({ error: { code: 'missing_tag', message: 'A tag is required.' } });
      }
      const { affected } = batchAction(
        db,
        ids,
        action,
        typeof body.tag === 'string' ? body.tag : undefined
      );
      return action === 'delete' ? { deleted: affected } : { updated: affected };
    }
  );

  // GET /api/export — the whole collection as a portable JSON download (FR-026/FR-027).
  app.get('/export', async (_req, reply) => {
    const doc = exportCollection(db, new Date().toISOString());
    reply.header('content-type', 'application/json');
    reply.header('content-disposition', 'attachment; filename="bookmarks-export.json"');
    return doc;
  });

  // POST /api/import — restore/merge from an exported document (FR-028/FR-029/FR-030).
  app.post('/import', async (req, reply) => {
    try {
      const summary = importCollection(db, req.body);
      return summary;
    } catch (err) {
      if (err instanceof InvalidImportError) {
        // Nothing was changed (validation happens before/inside the transaction).
        return reply.status(400).send({ error: { code: 'invalid_import', message: err.message } });
      }
      throw err;
    }
  });

  // GET /api/bookmarks/:id — used to pick up enrichment results.
  app.get<{ Params: { id: string } }>('/bookmarks/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const bookmark = Number.isFinite(id) ? getById(db, id) : undefined;
    if (!bookmark) {
      return reply
        .status(404)
        .send({ error: { code: 'not_found', message: 'Bookmark not found.' } });
    }
    return { bookmark };
  });
}
