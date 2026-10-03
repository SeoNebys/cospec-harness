import type { FastifyInstance, FastifyReply } from "fastify";
import {
  type MetadataPreview,
  type MetadataPreviewRequest,
  MetadataPreviewRequestSchema,
} from "../../shared/contracts/api.js";
import { AddressValidationError } from "../../shared/types/address.js";
import { BookmarkRepository } from "../repositories/bookmark-repository.js";
import {
  fallbackTitleFromAddress,
  normalizeAddress,
} from "../services/bookmarks/address-normalizer.js";

export interface MetadataPreviewer {
  preview(address: string): Promise<MetadataPreview>;
}

function fallbackPreview(address: string): MetadataPreview {
  const title = fallbackTitleFromAddress(address);
  return {
    address,
    status: "pending",
    fallbackTitle: title,
    title,
    description: "",
    iconAvailable: false,
    errorCode: null,
  };
}

function addressProblem(reply: FastifyReply, error: AddressValidationError) {
  return reply.code(422).send({ code: error.code, message: error.message, field: error.field });
}

export async function registerMetadataRoutes(app: FastifyInstance, previewer?: MetadataPreviewer) {
  const bookmarks = new BookmarkRepository(app.database);

  app.post<{ Body: MetadataPreviewRequest }>(
    "/api/metadata/preview",
    { schema: { body: MetadataPreviewRequestSchema } },
    async (request, reply) => {
      try {
        const normalized = normalizeAddress(request.body.address);
        const existing = bookmarks.findIdentityByNormalizedAddress(normalized.normalizedAddress);
        if (existing) {
          return reply.code(409).send({
            code: "DUPLICATE_BOOKMARK",
            message: "That address is already saved. Open the existing bookmark to edit it.",
            field: "address",
            existingBookmarkId: existing.id,
            existingScope: existing.archived ? "archived" : "active",
          });
        }
        return previewer?.preview(normalized.address) ?? fallbackPreview(normalized.address);
      } catch (error) {
        if (error instanceof AddressValidationError) return addressProblem(reply, error);
        throw error;
      }
    },
  );
}
