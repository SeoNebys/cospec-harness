import type { FastifyInstance } from "fastify";
import type { Auth } from "./auth.js";

export function registerAuthRoutes(app: FastifyInstance, auth: Auth): void {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const headers = new Headers();
      for (const [key, raw] of Object.entries(request.headers)) {
        if (raw === undefined) continue;
        if (Array.isArray(raw)) raw.forEach((value) => headers.append(key, value));
        else headers.set(key, String(raw));
      }
      const url = new URL(request.raw.url ?? request.url, `${request.protocol}://${request.hostname}`);
      const body = request.method === "GET" ? undefined : JSON.stringify(request.body ?? {});
      const response = await auth.handler(new Request(url, { method: request.method, headers, body }));
      reply.status(response.status);
      for (const [key, value] of response.headers) {
        if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      reply.send(Buffer.from(await response.arrayBuffer()));
    }
  });
}
