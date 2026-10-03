import type { FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import { AppError } from "./errors.js";

export function protectApplicationMutation(config: AppConfig) {
  return async function mutationGuard(request: FastifyRequest): Promise<void> {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
    if (request.url.startsWith("/api/auth/")) return;
    if (request.headers["x-bookmark-app"] !== "1") {
      throw new AppError(403, "REQUEST_REJECTED", "Request could not be verified");
    }
    if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
      throw new AppError(415, "JSON_REQUIRED", "Requests must use application/json");
    }
    const origin = request.headers.origin;
    if (!origin || (!config.trustedOrigins.includes(origin) && origin !== config.appOrigin && origin !== new URL(config.authBaseUrl).origin)) {
      throw new AppError(403, "REQUEST_REJECTED", "Request could not be verified");
    }
    if (request.headers["sec-fetch-site"] === "cross-site") {
      throw new AppError(403, "REQUEST_REJECTED", "Request could not be verified");
    }
  };
}
