import type { FastifyInstance } from "fastify";
import {
  type BulkAction,
  BulkActionSchema,
  type SelectionCreate,
  SelectionCreateSchema,
  type SelectionIdParams,
  SelectionIdParamsSchema,
} from "../../shared/contracts/api.js";
import { SearchQuerySyntaxError } from "../../shared/search/types.js";
import {
  EmptySelectionError,
  SelectionCriteriaHashError,
  SelectionExpiredError,
  SelectionNotFoundError,
  SelectionRepository,
} from "../repositories/selection-repository.js";
import { TagNameValidationError } from "../repositories/tag-repository.js";
import { BulkActionService } from "../services/selection/bulk-action-service.js";

export async function registerSelectionRoutes(app: FastifyInstance) {
  const selections = new SelectionRepository(app.database, app.now);
  const bulk = new BulkActionService(app.database, app.now);

  app.post<{ Body: SelectionCreate }>(
    "/api/selections",
    { schema: { body: SelectionCreateSchema } },
    async (request, reply) => {
      try {
        const selection =
          request.body.mode === "ids"
            ? selections.createIds(request.body.ids, request.body.criteriaHash)
            : selections.createAllResults(request.body.criteria, request.body.criteriaHash);
        return reply.code(201).send(selection);
      } catch (error) {
        if (error instanceof SearchQuerySyntaxError) {
          return reply.code(422).send({
            code: error.code,
            message: error.message,
            field: "criteria.query",
            start: error.range.start,
            end: error.range.end,
            hint: error.hint,
          });
        }
        if (error instanceof SelectionCriteriaHashError || error instanceof EmptySelectionError) {
          return reply.code(422).send({
            code: error.code,
            message: error.message,
            field: error.field,
            start: 0,
            end: error instanceof SelectionCriteriaHashError ? request.body.criteriaHash.length : 0,
            hint:
              error instanceof SelectionCriteriaHashError
                ? "Clear the selection and select the current view again"
                : "Select at least one bookmark from the current view",
          });
        }
        throw error;
      }
    },
  );

  app.delete<{ Params: SelectionIdParams }>(
    "/api/selections/:selectionId",
    { schema: { params: SelectionIdParamsSchema } },
    async (request, reply) => {
      selections.clear(request.params.selectionId);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: SelectionIdParams; Body: BulkAction }>(
    "/api/selections/:selectionId/actions",
    { schema: { params: SelectionIdParamsSchema, body: BulkActionSchema } },
    async (request, reply) => {
      try {
        return bulk.apply(request.params.selectionId, request.body);
      } catch (error) {
        if (error instanceof SelectionExpiredError) {
          return reply.code(409).send({ code: "SELECTION_EXPIRED", message: error.message });
        }
        if (error instanceof SelectionNotFoundError) {
          return reply.code(404).send({ code: "SELECTION_NOT_FOUND", message: error.message });
        }
        if (error instanceof TagNameValidationError) {
          return reply
            .code(422)
            .send({ code: error.code, message: error.message, field: error.field });
        }
        throw error;
      }
    },
  );
}
