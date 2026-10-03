import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { openDatabase } from '../../src/server/db/connection.js';
import { runMigrations } from '../../src/server/db/migrate.js';
import { createTestDatabase } from '../helpers/database.js';

describe('foundation', () => {
  it('migrates once and enables foreign keys', () => {
    const test = createTestDatabase();
    expect(test.database.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(test.database.prepare('select count(*) as count from schema_migrations').get()).toEqual({ count: 1 });
    runMigrations(test.database);
    expect(test.database.prepare('select count(*) as count from schema_migrations').get()).toEqual({ count: 1 });
    test.cleanup();
  });

  it('rolls back a failed migration', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'bookmark-migration-test-'));
    writeFileSync(path.join(directory, '001_bad.sql'), 'CREATE TABLE partial(id TEXT); INVALID SQL;');
    const database = openDatabase(':memory:');
    expect(() => runMigrations(database, directory)).toThrow();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE name = 'partial'").get()).toBeUndefined();
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('reports health and structured not found errors', async () => {
    const test = createTestDatabase();
    const app = createApp({ database: test.database });
    await request(app).get('/api/health').expect(200, { status: 'ready' });
    const response = await request(app).get('/api/missing').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    test.cleanup();
  });
});
