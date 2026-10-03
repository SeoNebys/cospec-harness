import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config/schema.js';
import { emailSchema, passwordSchema } from '../../shared/schemas/common.js';
import type { AuthService } from '../auth/auth-service.js';
import {
  clearSessionCookies,
  CSRF_COOKIE,
  issueAnonymousCsrf,
  SESSION_COOKIE,
  setCsrfCookie,
  setSessionCookies,
} from '../auth/auth-plugin.js';
import { hashOpaqueToken } from '../auth/auth-service.js';

const credentials = z.object({ email: emailSchema, password: passwordSchema });

export async function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: { config: AppConfig; authService: AuthService },
): Promise<void> {
  const { config, authService } = dependencies;

  app.get('/api/auth/session', async (request, reply) => {
    let csrfToken: string;
    if (request.currentSession) {
      const signed = request.cookies[CSRF_COOKIE];
      const unsigned = signed ? request.unsignCookie(signed) : null;
      const existingToken = unsigned?.valid ? unsigned.value : null;
      if (existingToken && hashOpaqueToken(existingToken) === request.currentSession.csrfSecretHash) {
        csrfToken = existingToken;
      } else {
        csrfToken = authService.rotateCsrf(request.currentSession.id);
        setCsrfCookie(reply, config, csrfToken, new Date(request.currentSession.expiresAt));
      }
    } else {
      csrfToken = issueAnonymousCsrf(reply, config);
    }
    return {
      authenticated: Boolean(request.currentUser),
      csrfToken,
      user: request.currentUser
        ? { id: request.currentUser.publicId, email: request.currentUser.email }
        : null,
    };
  });

  app.post('/api/auth/register', async (request, reply) => {
    const input = credentials.parse(request.body);
    const session = await authService.register(input.email, input.password);
    setSessionCookies(reply, config, session.sessionToken, session.csrfToken, session.expiresAt);
    return reply.status(201).send({
      authenticated: true,
      csrfToken: session.csrfToken,
      user: { id: session.user.publicId, email: session.user.email },
    });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const input = credentials.parse(request.body);
    const session = await authService.login(input.email, input.password);
    setSessionCookies(reply, config, session.sessionToken, session.csrfToken, session.expiresAt);
    return {
      authenticated: true,
      csrfToken: session.csrfToken,
      user: { id: session.user.publicId, email: session.user.email },
    };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    authService.revoke(request.cookies[SESSION_COOKIE]);
    clearSessionCookies(reply, config);
    return reply.status(204).send();
  });

  app.post('/api/auth/password-reset/request', async (request, reply) => {
    const input = z.object({ email: emailSchema }).parse(request.body);
    const appOrigin = [...config.appOrigins][0] ?? 'http://maker:4000';
    await authService.requestReset(input.email, appOrigin);
    return reply.status(202).send({
      message: 'If that account exists, a password reset link has been sent.',
    });
  });

  app.post('/api/auth/password-reset/confirm', async (request, reply) => {
    const input = z.object({ token: z.string().min(20), password: passwordSchema }).parse(request.body);
    await authService.confirmReset(input.token, input.password);
    clearSessionCookies(reply, config);
    return reply.status(204).send();
  });
}
