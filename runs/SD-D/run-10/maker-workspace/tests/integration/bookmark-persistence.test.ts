import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from '../../src/server/app';
import { createTestConfig, registerTestUser } from '../helpers/test-app';
import { openDatabase } from '../../src/server/db/database';

describe('bookmark persistence', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it('keeps saved data after an application restart', async () => {
    const config = createTestConfig();
    app = await buildApp({ config });
    const session = await registerTestUser(app, 'persist@example.test');
    const created = await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      headers: { cookie: session.cookie, 'x-csrf-token': session.csrf, origin: 'http://localhost' },
      payload: { url: 'https://example.com/restart', title: 'Persistent' },
    });
    expect(created.statusCode).toBe(201);
    await app.close();
    app = await buildApp({ config });
    const list = await app.inject({
      method: 'GET',
      url: '/api/bookmarks',
      headers: { cookie: session.cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
  });

  it('rolls back an earlier media promotion when a later promotion fails', async () => {
    const config = createTestConfig();
    app = await buildApp({ config });
    const session = await registerTestUser(app, 'rollback@example.test');
    const database = openDatabase(config.databasePath);
    const user = database
      .prepare('SELECT id FROM users WHERE email_normalized = ?')
      .get('rollback@example.test') as { id: number };
    const now = Date.now();
    const goodKey = '.drafts/med_rollback_good.png';
    const missingKey = '.drafts/med_rollback_missing.png';
    const insert = database.prepare(
      `INSERT INTO media_assets(public_id, user_id, purpose, status, storage_key, source_url,
        mime_type, byte_size, sha256, created_at, expires_at)
       VALUES (?, ?, ?, 'draft', ?, NULL, 'image/png', 4, 'fixture', ?, ?)`,
    );
    insert.run('med_rollback_good', user.id, 'favicon', goodKey, now, now + 60_000);
    insert.run('med_rollback_missing', user.id, 'preview', missingKey, now, now + 60_000);
    mkdirSync(join(config.assetDirectory, '.drafts'), { recursive: true });
    writeFileSync(join(config.assetDirectory, goodKey), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const response = await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      headers: {
        cookie: session.cookie,
        'x-csrf-token': session.csrf,
        origin: 'http://localhost',
      },
      payload: {
        url: 'https://example.com/rollback',
        title: 'Should roll back',
        faviconAssetId: 'med_rollback_good',
        previewAssetId: 'med_rollback_missing',
      },
    });
    expect(response.statusCode).toBe(500);
    const promoted = database
      .prepare('SELECT status, storage_key FROM media_assets WHERE public_id = ?')
      .get('med_rollback_good') as { status: string; storage_key: string };
    expect(promoted).toEqual({ status: 'draft', storage_key: goodKey });
    expect(existsSync(join(config.assetDirectory, goodKey))).toBe(true);
    expect(
      (
        database.prepare('SELECT COUNT(*) AS count FROM bookmarks WHERE user_id = ?').get(user.id) as {
          count: number;
        }
      ).count,
    ).toBe(0);
    database.close();
  });
});
