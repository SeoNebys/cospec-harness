import type { RequestHandler } from 'express';
import type { AuthRepository } from '../auth/auth-repository.js';
import { COOKIE_NAME, digestToken } from '../auth/sessions.js';

export type AuthenticatedUser = { id: string; email: string; sessionDigest: string };

export function requireUser(repository: AuthRepository): RequestHandler {
  return (request, response, next) => {
    const token = request.cookies?.[COOKIE_NAME] as string | undefined;
    const session = token ? repository.findSession(digestToken(token)) : undefined;
    if (!session)
      return response
        .status(401)
        .json({ code: 'UNAUTHORIZED', message: 'Please sign in to continue.' });
    response.locals.user = {
      id: session.user_id,
      email: session.email,
      sessionDigest: session.token_digest,
    } satisfies AuthenticatedUser;
    next();
  };
}

export function currentUser(response: { locals: { user: AuthenticatedUser } }) {
  return response.locals.user;
}
