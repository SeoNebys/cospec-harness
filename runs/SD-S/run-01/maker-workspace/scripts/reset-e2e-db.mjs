import { rm } from 'node:fs/promises';

for (const suffix of ['', '-shm', '-wal']) {
  await rm(`/tmp/bookmark-manager-e2e.db${suffix}`, { force: true });
}
