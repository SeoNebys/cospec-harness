import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import {
  createBookmarkSchema,
  listQuerySchema,
  updateBookmarkSchema,
} from "../models/bookmark.js";
import { invalidInput } from "../errors.js";
import type { BookmarkService } from "../services/bookmarks.js";

export function registerBookmarkRoutes(
  app: FastifyInstance,
  service: BookmarkService,
): void {
  app.get("/api/bookmarks", (req) => {
    const query = listQuerySchema.parse(req.query);
    return service.list(query);
  });

  app.get("/api/bookmarks/:id", (req) => {
    const { id } = req.params as { id: string };
    return service.get(id);
  });

  app.post("/api/bookmarks", async (req, reply) => {
    const body = parseOrThrow(createBookmarkSchema, req.body);
    const created = await service.create(body);
    return reply.code(201).send(created);
  });

  app.put("/api/bookmarks/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = parseOrThrow(updateBookmarkSchema, req.body);
    return service.update(id, body);
  });

  app.delete("/api/bookmarks/:id", (req) => {
    const { id } = req.params as { id: string };
    return service.softDelete(id);
  });

  app.post("/api/bookmarks/:id/restore", (req) => {
    const { id } = req.params as { id: string };
    return service.restore(id);
  });
}

/** Parse with zod, converting validation failures into a 400 invalid input error. */
function parseOrThrow<T>(schema: {
  parse: (v: unknown) => T;
}, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors[0];
      const path = first?.path.join(".");
      throw invalidInput(
        path ? `${path}: ${first?.message}` : (first?.message ?? "Invalid input."),
      );
    }
    throw err;
  }
}
