import type { Env } from '../../config/env.js';
import { SessionRepository } from '../../repositories/session-repository.js';
import { UserRepository } from '../../repositories/user-repository.js';
import { hashPassword, hashSessionToken, newSessionToken, verifyPassword } from '../../security/session.js';

export class AuthError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }

export class AuthService {
  constructor(private users: UserRepository, private sessions: SessionRepository, private env: Env) {}
  async register(email: string, password: string) {
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AuthError('VALIDATION_ERROR', 'Enter a valid email address.');
    if (password.length < 12 || password.length > 128) throw new AuthError('VALIDATION_ERROR', 'Password must be 12–128 characters.');
    if (this.users.byEmail(email)) throw new AuthError('ACCOUNT_EXISTS', 'An account already exists for that email.', 409);
    const user = this.users.create(email, await hashPassword(password));
    return this.issue(user.id, user.email);
  }
  async login(email: string, password: string) {
    const user = this.users.byEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) throw new AuthError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
    this.sessions.deleteForUser(user.id);
    return this.issue(user.id, user.email);
  }
  authenticate(token?: string) {
    if (!token) return undefined;
    const session = this.sessions.findValid(hashSessionToken(token));
    if (!session) return undefined;
    const user = this.users.byId(session.user_id);
    if (!user) return undefined;
    this.sessions.touch(session.id);
    return { id: user.id, email: user.email };
  }
  logout(token?: string) { if (token) this.sessions.deleteByHash(hashSessionToken(token)); }
  private issue(userId: string, email: string) {
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + this.env.sessionHours * 3_600_000).toISOString();
    this.sessions.create(userId, hashSessionToken(token), expiresAt);
    return { user: { id: userId, email }, token, expiresAt };
  }
}
