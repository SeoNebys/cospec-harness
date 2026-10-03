import { mkdirSync, rmSync } from 'node:fs';

export default function setup() {
  const directory = '/work/implementation/tests/.tmp';
  mkdirSync(directory, { recursive: true });
  for (const filename of ['e2e.sqlite', 'e2e.sqlite-wal', 'e2e.sqlite-shm']) {
    rmSync(`${directory}/${filename}`, { force: true });
  }
}
