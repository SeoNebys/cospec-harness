import type { FastifyInstance, FastifyReply } from "fastify";
import {
  type BookmarkCreate,
  BookmarkCreateSchema,
  type BookmarkIdParams,
  BookmarkIdParamsSchema,
  type BookmarkListQuery,
  BookmarkListQuerySchema,
  type BookmarkPatch,
  BookmarkPatchSchema,
} from "../../shared/contracts/api.js";
import { SearchQuerySyntaxError } from "../../shared/search/types.js";
import { AddressValidationError } from "../../shared/types/address.js";
import { NoteValidationError } from "../../shared/types/notes.js";
import {
  BookmarkNotFoundError,
  BookmarkRepository,
  DuplicateBookmarkError,
} from "../repositories/bookmark-repository.js";
import { IconRepository } from "../repositories/icon-repository.js";
import { InvalidSearchCursorError, SearchRepository } from "../repositories/search-repository.js";
import { TagNameValidationError } from "../repositories/tag-repository.js";
import {
  fallbackTitleFromAddress,
  normalizeAddress,
} from "../services/bookmarks/address-normalizer.js";
import { BookmarkDeleteService } from "../services/bookmarks/bookmark-delete-service.js";
import { BookmarkStateService } from "../services/bookmarks/bookmark-state-service.js";
import {
  BookmarkTitleValidationError,
  BookmarkUpdateService,
} from "../services/bookmarks/bookmark-update-service.js";

export interface MetadataQueue {
  enqueue(bookmarkId: number, address: string, addressRevision: number): void;
}

function sendAddressProblem(reply: FastifyReply, error: AddressValidationError) {
  return reply.code(422).send({ code: error.code, message: error.message, field: error.field });
}

function sendDuplicate(reply: FastifyReply, error: DuplicateBookmarkError) {
  return reply.code(409).send({
    code: "DUPLICATE_BOOKMARK",
    message: "That address is already saved. Open the existing bookmark to edit it.",
    field: "address",
    existingBookmarkId: error.identity.id,
    existingScope: error.identity.archived ? "archived" : "active",
  });
}

export async function registerBookmarkRoutes(app: FastifyInstance, metadataQueue?: MetadataQueue) {
  const bookmarks = new BookmarkRepository(app.database);
  const icons = new IconRepository(app.database);
  const search = new SearchRepository(app.database);
  const state = new BookmarkStateService(bookmarks, app.now);
  const updates = new BookmarkUpdateService(app.database, app.now);
  const deletion = new BookmarkDeleteService(app.database);

  app.post<{ Body: BookmarkCreate }>(
    "/api/bookmarks",
    { schema: { body: BookmarkCreateSchema } },
    async (request, reply) => {
      try {
        const normalized = normalizeAddress(request.body.address);
        const bookmark = bookmarks.create({
          input: request.body,
          address: normalized.address,
          normalizedAddress: normalized.normalizedAddress,
          fallbackTitle: fallbackTitleFromAddress(normalized.address),
          now: app.now().toISOString(),
        });
        search.synchronizeBookmark(bookmark.id);
        const row = bookmarks.getRow(bookmark.id);
        if (row) metadataQueue?.enqueue(bookmark.id, bookmark.address, row.address_revision);
        return reply.code(201).send(bookmark);
      } catch (error) {
        if (error instanceof AddressValidationError) return sendAddressProblem(reply, error);
        if (error instanceof DuplicateBookmarkError) return sendDuplicate(reply, error);
        if (error instanceof TagNameValidationError || error instanceof NoteValidationError) {
          return reply
            .code(422)
            .send({ code: error.code, message: error.message, field: error.field });
        }
        throw error;
      }
    },
  );

  app.get<{ Querystring: BookmarkListQuery }>(
    "/api/bookmarks",
    { schema: { querystring: BookmarkListQuerySchema } },
    async (request, reply) => {
      try {
        const rawTags = request.query.tag as unknown;
        const tags = Array.isArray(rawTags)
          ? rawTags.map(String)
          : typeof rawTags === "string"
            ? [rawTags]
            : [];
        return search.search({
          scope: request.query.scope ?? "active",
          query: request.query.q ?? "",
          tags,
          favorite: request.query.favorite ?? null,
          unread: request.query.unread ?? null,
          sort: request.query.sort ?? "created_desc",
          ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
          limit: request.query.limit ?? 50,
        });
      } catch (error) {
        if (error instanceof SearchQuerySyntaxError) {
          return reply.code(422).send({
            code: error.code,
            message: error.message,
            field: "q",
            start: error.range.start,
            end: error.range.end,
            hint: error.hint,
          });
        }
        if (error instanceof InvalidSearchCursorError) {
          return reply.code(422).send({
            code: "INVALID_CURSOR",
            message: error.message,
            field: "cursor",
            start: 0,
            end: request.query.cursor?.length ?? 0,
            hint: "Reload the first page of results",
          });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: BookmarkIdParams }>(
    "/api/bookmarks/:bookmarkId",
    { schema: { params: BookmarkIdParamsSchema } },
    async (request, reply) => {
      try {
        return bookmarks.get(request.params.bookmarkId);
      } catch (error) {
        if (error instanceof BookmarkNotFoundError) {
          return reply.code(404).send({ code: "BOOKMARK_NOT_FOUND", message: error.message });
        }
        throw error;
      }
    },
  );

  app.patch<{ Params: BookmarkIdParams; Body: BookmarkPatch }>(
    "/api/bookmarks/:bookmarkId",
    { schema: { params: BookmarkIdParamsSchema, body: BookmarkPatchSchema } },
    async (request, reply) => {
      try {
        if (request.body.unread !== undefined && Object.keys(request.body).length === 1) {
          return state.setUnread(request.params.bookmarkId, request.body.unread);
        }
        const result = updates.update(request.params.bookmarkId, request.body);
        if (result.metadataRequest) {
          metadataQueue?.enqueue(
            result.metadataRequest.bookmarkId,
            result.metadataRequest.address,
            result.metadataRequest.addressRevision,
          );
        }
        return result.bookmark;
      } catch (error) {
        if (error instanceof AddressValidationError) return sendAddressProblem(reply, error);
        if (error instanceof DuplicateBookmarkError) return sendDuplicate(reply, error);
        if (
          error instanceof BookmarkTitleValidationError ||
          error instanceof TagNameValidationError ||
          error instanceof NoteValidationError
        ) {
          return reply
            .code(422)
            .send({ code: error.code, message: error.message, field: error.field });
        }
        if (error instanceof BookmarkNotFoundError) {
          return reply.code(404).send({ code: "BOOKMARK_NOT_FOUND", message: error.message });
        }
        throw error;
      }
    },
  );

  app.delete<{ Params: BookmarkIdParams }>(
    "/api/bookmarks/:bookmarkId",
    { schema: { params: BookmarkIdParamsSchema } },
    async (request, reply) => {
      try {
        deletion.delete(request.params.bookmarkId);
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof BookmarkNotFoundError) {
          return reply.code(404).send({ code: "BOOKMARK_NOT_FOUND", message: error.message });
        }
        throw error;
      }
    },
  );

  app.post<{ Params: BookmarkIdParams }>(
    "/api/bookmarks/:bookmarkId/metadata-refresh",
    { schema: { params: BookmarkIdParamsSchema } },
    async (request, reply) => {
      try {
        const metadataRequest = updates.requestMetadataRefresh(request.params.bookmarkId);
        metadataQueue?.enqueue(
          metadataRequest.bookmarkId,
          metadataRequest.address,
          metadataRequest.addressRevision,
        );
        return reply.code(202).send({
          bookmarkId: metadataRequest.bookmarkId,
          metadataStatus: "pending",
        });
      } catch (error) {
        if (error instanceof BookmarkNotFoundError) {
          return reply.code(404).send({ code: "BOOKMARK_NOT_FOUND", message: error.message });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: BookmarkIdParams }>(
    "/api/bookmarks/:bookmarkId/icon",
    { schema: { params: BookmarkIdParamsSchema } },
    async (request, reply) => {
      const bytes = icons.getForBookmark(request.params.bookmarkId);
      if (!bytes) return reply.code(404).send();
      return reply
        .header("Content-Type", "image/png")
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .send(bytes);
    },
  );
}
