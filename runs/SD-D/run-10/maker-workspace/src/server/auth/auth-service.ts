import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppError } from '../api/errors.js';
import type { AuthRepository, UserRow } from '../repositories/auth-repository.js';
import type { MailProvider } from './mail-provider.js';

export type AuthUser = { id: number; publicId: string; email: string };
export type IssuedSession = { user: AuthUser; sessionToken: string; csrfToken: string; expiresAt: number };

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function opaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

function toAuthUser(user: UserRow): AuthUser {
  return { id: user.id, publicId: user.publicId, email: user.email };
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly mail: MailProvider,
    private readonly sessionDays: number,
    private readonly resetMinutes: number,
  ) {}

  async register(email: string, password: string): Promise<IssuedSession> {
    const normalized = normalizeEmail(email);
    if (this.repository.getUserByEmail(normalized)) {
      throw new AppError(409, 'account_unavailable', 'An account cannot be created with those details.');
    }
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    let user: UserRow;
    try {
      user = this.repository.createUser({
        publicId: `usr_${randomUUID()}`,
        email: email.trim(),
        emailNormalized: normalized,
        passwordHash,
      });
    } catch {
      throw new AppError(409, 'account_unavailable', 'An account cannot be created with those details.');
    }
    return this.issueSession(user);
  }

  async login(email: string, password: string): Promise<IssuedSession> {
    const user = this.repository.getUserByEmail(normalizeEmail(email));
    const valid = user ? await argon2.verify(user.passwordHash, password) : false;
    if (!user || !valid) throw new AppError(401, 'invalid_credentials', 'Email or password is incorrect.');
    return this.issueSession(user);
  }

  revoke(rawToken: string | undefined): void {
    if (rawToken) this.repository.revokeSession(hashOpaqueToken(rawToken));
  }

  rotateCsrf(sessionId: number): string {
    const csrfToken = opaqueToken(24);
    this.repository.updateSessionCsrf(sessionId, hashOpaqueToken(csrfToken));
    return csrfToken;
  }

  async requestReset(email: string, appOrigin: string): Promise<void> {
    const user = this.repository.getUserByEmail(normalizeEmail(email));
    if (!user) return;
    const raw = opaqueToken();
    const expiresAt = Date.now() + this.resetMinutes * 60_000;
    this.repository.createResetToken(user.id, hashOpaqueToken(raw), expiresAt);
    const url = `${appOrigin}/?reset=${encodeURIComponent(raw)}`;
    await this.mail.sendPasswordReset({ to: user.email, resetUrl: url, expiresAt });
  }

  async confirmReset(token: string, password: string): Promise<void> {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    if (!this.repository.resetPassword(hashOpaqueToken(token), passwordHash)) {
      throw new AppError(422, 'invalid_reset_token', 'This reset link is invalid or has expired.');
    }
  }

  private issueSession(user: UserRow): IssuedSession {
    const sessionToken = opaqueToken();
    const csrfToken = opaqueToken(24);
    const expiresAt = Date.now() + this.sessionDays * 86_400_000;
    this.repository.createSession({
      userId: user.id,
      tokenHash: hashOpaqueToken(sessionToken),
      csrfSecretHash: hashOpaqueToken(csrfToken),
      expiresAt,
    });
    return { user: toAuthUser(user), sessionToken, csrfToken, expiresAt };
  }
}
