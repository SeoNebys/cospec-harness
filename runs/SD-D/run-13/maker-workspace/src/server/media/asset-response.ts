import type { FastifyReply, FastifyRequest } from 'fastify';

export function sendAsset(request: FastifyRequest, reply: FastifyReply, asset: { id: string; mime_type?: string; mimeType?: string; bytes: Buffer; byte_length?: number; byteLength?: number }, immutable = true) {
  const etag = `"${asset.id}"`;
  if (request.headers['if-none-match'] === etag) return reply.status(304).send();
  return reply.header('Content-Type', asset.mimeType || asset.mime_type!).header('Content-Length', asset.byteLength || asset.byte_length!).header('ETag', etag).header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'private, max-age=300').header('X-Content-Type-Options', 'nosniff').send(asset.bytes);
}
