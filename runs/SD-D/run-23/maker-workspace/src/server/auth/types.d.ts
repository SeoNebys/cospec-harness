import '@fastify/secure-session';
import 'fastify';

declare module '@fastify/secure-session' {
  interface SessionData {
    userPublicId?: string;
    csrfToken?: string;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: { id: number; publicId: string; email: string; libraryRevision: number } | null;
  }
}
