import { Router, type RequestHandler } from 'express';
import type { Config } from '../config.js';
import type { AuthRepository } from './auth-repository.js';
import { credentialsSchema } from '../../shared/contracts/auth.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  clearSessionCookie,
  COOKIE_NAME,
  createSessionValues,
  digestToken,
  setSessionCookie,
} from './sessions.js';
import { requireUser } from '../middleware/require-user.js';
import { rateLimit } from '../middleware/rate-limit.js';

export function authRoutes(repository: AuthRepository, config: Config): Router {
  const router = Router();
  const limited: RequestHandler = rateLimit(12, 60_000);

  router.post('/register', limited, async (request, response, next) => {
    try {
      const input = credentialsSchema.parse(request.body);
      if (repository.findUserByEmail(input.email))
        return response
          .status(409)
          .json({ code: 'EMAIL_CONFLICT', message: 'An account already uses that email.' });
      const user = repository.createUser(input.email, await hashPassword(input.password));
      const session = createSessionValues(config);
      repository.createSession(user.id, session);
      setSessionCookie(response, session.token, config);
      response.status(201).json({ id: user.id, email: user.email });
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', limited, async (request, response, next) => {
    try {
      const input = credentialsSchema.parse(request.body);
      const user = repository.findUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.password_hash)))
        return response
          .status(401)
          .json({ code: 'INVALID_CREDENTIALS', message: 'Email or password was not accepted.' });
      const session = createSessionValues(config);
      repository.createSession(user.id, session);
      setSessionCookie(response, session.token, config);
      response.json({ id: user.id, email: user.email });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', requireUser(repository), (request, response) => {
    const token = request.cookies?.[COOKIE_NAME] as string;
    repository.deleteSession(digestToken(token));
    clearSessionCookie(response, config);
    response.status(204).end();
  });

  router.get('/me', requireUser(repository), (_request, response) =>
    response.json({ id: response.locals.user.id, email: response.locals.user.email }),
  );
  return router;
}
