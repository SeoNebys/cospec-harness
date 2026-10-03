import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Auth } from "../auth/auth.js";
import { requireSession } from "../auth/require-session.js";
import { organizationNameInput } from "../../shared/validation/organization.js";
import { positiveId } from "../../shared/validation/common.js";
import type { OrganizationRepository } from "../repositories/organization-repository.js";
import type { OrganizationService } from "../services/organization-service.js";

export function registerOrganizationRoutes(app: FastifyInstance, auth: Auth, repository: OrganizationRepository, service: OrganizationService): void {
  for (const kind of ["folders", "tags"] as const) {
    app.get(`/api/${kind}`, async (request) => {
      const session = await requireSession(auth, request);
      return kind === "folders" ? repository.listFolders(session.user.id) : repository.listTags(session.user.id);
    });
    app.post(`/api/${kind}`, async (request, reply) => {
      const session = await requireSession(auth, request);
      const { name } = organizationNameInput(kind === "folders" ? "folder" : "tag").parse(request.body);
      reply.status(201).send(service.create(kind, session.user.id, name));
    });
    app.patch(`/api/${kind}/:id`, async (request) => {
      const session = await requireSession(auth, request);
      const { id } = z.object({ id: positiveId }).parse(request.params);
      const { name } = organizationNameInput(kind === "folders" ? "folder" : "tag").parse(request.body);
      service.rename(kind, session.user.id, id, name);
      return { id, name };
    });
    app.delete(`/api/${kind}/:id`, async (request, reply) => {
      const session = await requireSession(auth, request);
      const { id } = z.object({ id: positiveId }).parse(request.params);
      service.delete(kind, session.user.id, id);
      reply.status(204).send();
    });
  }
}
