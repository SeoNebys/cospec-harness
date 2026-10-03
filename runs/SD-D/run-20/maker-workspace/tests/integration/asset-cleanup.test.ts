import { existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanupExpiredAssets } from '../../src/server/metadata/cleanup';
import { temporaryDatabase } from '../fixtures/database';
it('reconciles expired temporary assets in the database before deleting files', async () => {
  const fixture = temporaryDatabase();
  const directory = mkdtempSync(join(tmpdir(), 'pinboard-cleanup-'));
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'old.png'), 'x');
  fixture.db
    .prepare(
      `INSERT INTO media_assets(public_id,content_hash,media_type,byte_length,relative_path,state,expires_at,created_at) VALUES ('00000000-0000-4000-8000-000000000001','hash','image/png',1,'old.png','temporary','2000-01-01T00:00:00.000Z','2000-01-01T00:00:00.000Z')`,
    )
    .run();
  await cleanupExpiredAssets(fixture.db, new Date(), directory);
  expect(
    (fixture.db.prepare('select count(*) count from media_assets').get() as { count: number }).count,
  ).toBe(0);
  expect(existsSync(join(directory, 'old.png'))).toBe(false);
  fixture.close();
  rmSync(directory, { recursive: true, force: true });
});
