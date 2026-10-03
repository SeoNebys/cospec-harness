import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { MediaStore } from '../../src/server/metadata/mediaStore';
import { MediaRepository } from '../../src/server/repositories/mediaRepository';
import { temporaryDatabase } from '../fixtures/database';
it('signature-checks, hashes, deduplicates and serves only accepted raster bytes', async () => {
  const fixture = temporaryDatabase();
  const directory = mkdtempSync(join(tmpdir(), 'pinboard-media-'));
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const transport = async (url: string) => ({ url, statusCode: 200, contentType: 'image/png', body: png });
  const repository = new MediaRepository(fixture.db);
  const store = new MediaStore(repository, transport, directory);
  const expiry = new Date(Date.now() + 10000).toISOString();
  const one = await store.cache('https://example.com/one.png', expiry);
  const two = await store.cache('https://example.com/two.png', expiry);
  expect(one?.id).toBe(two?.id);
  expect(await store.bytes(one!)).toEqual(png);
  fixture.close();
  rmSync(directory, { recursive: true, force: true });
});
