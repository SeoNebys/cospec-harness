import type { FastifyInstance } from "fastify";
import { badRequest } from "./errors.js";
import type { BookmarkService } from "../services/bookmarkService.js";

interface CreateBody {
  url?: unknown;
  title?: unknown;
  note?: unknown;
  tags?: unknown;
  allowDuplicate?: unknown;
}

interface UpdateBody {
  title?: unknown;
  note?: unknown;
  tags?: unknown;
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw badRequest("Expected a string value.");
  return v;
}

function asTags(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((t) => typeof t !== "string")) {
    throw badRequest("Tags must be an array of strings.");
  }
  return v as string[];
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid bookmark id.");
  return id;
}

/**
 * Register bookmark endpoints. `scheduleEnrich` runs the async metadata fetch
 * without blocking the create response (FR-017); it defaults to setImmediate.
 */
export function registerBookmarkRoutes(
  app: FastifyInstance,
  service: BookmarkService,
  scheduleEnrich: (fn: () => void) => void,
): void {
  // Create — persists immediately, enriches in the background (FR-001, FR-014, FR-017)
  app.post("/api/bookmarks", (req, reply) => {
    const body = (req.body ?? {}) as CreateBody;
    const bookmark = service.create({
      url: asString(body.url) ?? "",
      title: asString(body.title),
      note: asString(body.note),
      tags: asTags(body.tags),
      allowDuplicate: body.allowDuplicate === true,
    });
    scheduleEnrich(() => {
      void service.enrich(bookmark.id).catch((err) => app.log.error(err));
    });
    reply.code(201).send({ bookmark });
  });

  // List / search / filter (FR-005, FR-006, FR-009)
  app.get("/api/bookmarks", (req, reply) => {
    const { q, tag } = req.query as { q?: string; tag?: string };
    reply.send({ bookmarks: service.list({ q, tag }) });
  });

  // Read one
  app.get("/api/bookmarks/:id", (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    reply.send({ bookmark: service.getById(id) });
  });

  // Edit (FR-010, FR-015)
  app.patch("/api/bookmarks/:id", (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    const body = (req.body ?? {}) as UpdateBody;
    const bookmark = service.update(id, {
      title: asString(body.title),
      note: asString(body.note),
      tags: asTags(body.tags),
    });
    reply.send({ bookmark });
  });

  // Delete (FR-011 — UI confirms before calling this)
  app.delete("/api/bookmarks/:id", (req, reply) => {
    const id = parseId((req.params as { id: string }).id);
    service.remove(id);
    reply.code(204).send();
  });
}
