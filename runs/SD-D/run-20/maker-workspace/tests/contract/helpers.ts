import type { FastifyInstance } from 'fastify';
export async function jsonRequest(app: FastifyInstance, method: string, url: string, body?: unknown) {
  const response = await app.inject({ method: method as never, url, payload: body as never });
  return { status: response.statusCode, body: response.json() as Record<string, unknown> };
}
