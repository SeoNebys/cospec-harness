import type { FastifyInstance, FastifyReply } from "fastify";

import {
  type SavedViewIdParams,
  SavedViewIdParamsSchema,
  SavedViewListSchema,
  SavedViewSchema,
  type SavedViewWrite,
  SavedViewWriteSchema,
} from "../../shared/contracts/api.js";
import { SearchQuerySyntaxError } from "../../shared/search/types.js";
import {
  DuplicateSavedViewNameError,
  InvalidSavedViewNameError,
  SavedViewNotFoundError,
  SavedViewRepository,
} from "../repositories/saved-view-repository.js";
import { SavedViewService } from "../services/search/saved-view-service.js";

function sendSavedViewError(reply: FastifyReply, error: unknown) {
  if (error instanceof DuplicateSavedViewNameError) {
    return reply.code(409).send({
      code: "DUPLICATE_SAVED_VIEW_NAME",
      message: error.message,
      field: "name",
    });
  }
  if (error instanceof SavedViewNotFoundError) {
    return reply.code(404).send({ code: "SAVED_VIEW_NOT_FOUND", message: error.message });
  }
  if (error instanceof SearchQuerySyntaxError) {
    return reply.code(422).send({
      code: error.code,
      message: error.message,
      field: "query",
      start: error.range.start,
      end: error.range.end,
      hint: error.hint,
    });
  }
  if (error instanceof InvalidSavedViewNameError) {
    return reply.code(422).send({
      code: error.code,
      message: error.message,
      field: error.field,
      start: 0,
      end: error.sourceLength,
      hint: error.hint,
    });
  }
  throw error;
}

export async function registerSavedViewRoutes(app: FastifyInstance): Promise<void> {
  const service = new SavedViewService(new SavedViewRepository(app.database), app.now);

  app.get("/api/saved-views", { schema: { response: { 200: SavedViewListSchema } } }, async () =>
    service.list(),
  );

  app.post<{ Body: SavedViewWrite }>(
    "/api/saved-views",
    { schema: { body: SavedViewWriteSchema, response: { 201: SavedViewSchema } } },
    async (request, reply) => {
      try {
        return reply.code(201).send(service.create(request.body));
      } catch (error) {
        return sendSavedViewError(reply, error);
      }
    },
  );

  app.patch<{ Params: SavedViewIdParams; Body: SavedViewWrite }>(
    "/api/saved-views/:savedViewId",
    {
      schema: {
        params: SavedViewIdParamsSchema,
        body: SavedViewWriteSchema,
        response: { 200: SavedViewSchema },
      },
    },
    async (request, reply) => {
      try {
        return service.update(request.params.savedViewId, request.body);
      } catch (error) {
        return sendSavedViewError(reply, error);
      }
    },
  );

  app.delete<{ Params: SavedViewIdParams }>(
    "/api/saved-views/:savedViewId",
    { schema: { params: SavedViewIdParamsSchema } },
    async (request, reply) => {
      try {
        service.delete(request.params.savedViewId);
        return reply.code(204).send();
      } catch (error) {
        return sendSavedViewError(reply, error);
      }
    },
  );
}
