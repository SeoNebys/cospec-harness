import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/server/db/database';
import { runMigrations } from '../../src/server/db/migration-runner';
import { AuthRepository } from '../../src/server/repositories/auth-repository';
import { AuthService, hashOpaqueToken, normalizeEmail } from '../../src/server/auth/auth-service';

describe('AuthService', () => {
  const databases: ReturnType<typeof openDatabase>[] = [];
  afterEach(() => databases.splice(0).forEach((database) => database.close()));

  it('normalizes email and issues a persisted opaque session', async () => {
    const database = openDatabase(':memory:');
    databases.push(database);
    runMigrations(database);
    const repository = new AuthRepository(database);
    const service = new AuthService(repository, { sendPasswordReset: async () => undefined }, 30, 30);
    const result = await service.register(' Person@Example.COM ', 'A very long test passphrase!');
    expect(normalizeEmail(' Person@Example.COM ')).toBe('person@example.com');
    expect(repository.findSession(hashOpaqueToken(result.sessionToken))?.email).toBe('Person@Example.COM');
  });

  it('uses generic invalid credential errors', async () => {
    const database = openDatabase(':memory:');
    databases.push(database);
    runMigrations(database);
    const service = new AuthService(
      new AuthRepository(database),
      { sendPasswordReset: async () => undefined },
      30,
      30,
    );
    await expect(service.login('missing@example.com', 'A very long wrong passphrase')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('expires sessions and issues a fresh opaque token at each authentication', async () => {
    const database = openDatabase(':memory:');
    databases.push(database);
    runMigrations(database);
    const repository = new AuthRepository(database);
    const service = new AuthService(repository, { sendPasswordReset: async () => undefined }, 30, 30);
    const first = await service.register('sessions@example.com', 'A very long test passphrase!');
    const second = await service.login('sessions@example.com', 'A very long test passphrase!');
    expect(second.sessionToken).not.toBe(first.sessionToken);
    expect(second.csrfToken).not.toBe(first.csrfToken);
    database
      .prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .run(Date.now() - 1, hashOpaqueToken(first.sessionToken));
    expect(repository.findSession(hashOpaqueToken(first.sessionToken))).toBeNull();
    expect(repository.findSession(hashOpaqueToken(second.sessionToken))).not.toBeNull();
  });

  it('consumes a recovery token once, changes the password, and revokes existing sessions', async () => {
    const database = openDatabase(':memory:');
    databases.push(database);
    runMigrations(database);
    const repository = new AuthRepository(database);
    let resetUrl = '';
    const service = new AuthService(
      repository,
      {
        sendPasswordReset: async (message) => {
          resetUrl = message.resetUrl;
        },
      },
      30,
      30,
    );
    const original = await service.register('recover@example.com', 'A very long old passphrase!');
    await service.requestReset('recover@example.com', 'http://localhost');
    const rawToken = new URL(resetUrl).searchParams.get('reset');
    expect(rawToken).toBeTruthy();
    expect(database.prepare('SELECT token_hash FROM password_reset_tokens').get()).not.toMatchObject({
      token_hash: rawToken,
    });
    await service.confirmReset(rawToken!, 'A very long new passphrase!');
    expect(repository.findSession(hashOpaqueToken(original.sessionToken))).toBeNull();
    await expect(service.confirmReset(rawToken!, 'Another very long passphrase!')).rejects.toMatchObject({
      code: 'invalid_reset_token',
    });
    await expect(service.login('recover@example.com', 'A very long old passphrase!')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(service.login('recover@example.com', 'A very long new passphrase!')).resolves.toBeDefined();
  });
});
