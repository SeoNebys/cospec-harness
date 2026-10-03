import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { MediaStore } from '../../src/server/metadata/mediaStore';
import { MediaRepository } from '../../src/server/repositories/mediaRepository';
import { MetadataPreviewRepository } from '../../src/server/repositories/metadataPreviewRepository';
import { MetadataPreviewService } from '../../src/server/services/metadataPreviewService';
import { temporaryDatabase } from '../fixtures/database';
import { fixtureTransport } from '../fixtures/metadata';
it('settles controlled metadata previews well within the recoverable budget', async () => {
  const fixture = temporaryDatabase();
  const repository = new MediaRepository(fixture.db);
  const service = new MetadataPreviewService(
    fixture.db,
    new MetadataPreviewRepository(fixture.db),
    new MediaStore(repository, fixtureTransport),
    fixtureTransport,
  );
  const durations = [];
  for (let index = 0; index < 20; index++) {
    const start = performance.now();
    await service.create(`https://example.com/perf-${index}`);
    durations.push(performance.now() - start);
  }
  expect(durations.filter((duration) => duration < 5000).length).toBeGreaterThanOrEqual(19);
  expect(Math.max(...durations)).toBeLessThan(10_000);
  fixture.close();
});
