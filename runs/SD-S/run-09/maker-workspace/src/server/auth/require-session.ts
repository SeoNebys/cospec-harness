import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import type { Auth } from "./auth.js";
import { AppError } from "../api/errors.js";

export async function requireSession(auth: Auth, request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session?.user?.id) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue");
  return session;
}
