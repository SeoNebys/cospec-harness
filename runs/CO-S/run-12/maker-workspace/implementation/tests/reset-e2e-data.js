import { unlink } from 'node:fs/promises';

await unlink('/tmp/keepwell-e2e-bookmarks.json').catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
