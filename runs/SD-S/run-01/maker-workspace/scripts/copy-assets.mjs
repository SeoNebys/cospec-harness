import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/server/server/db/migrations', { recursive: true });
await cp('src/server/db/migrations', 'dist/server/server/db/migrations', { recursive: true });
