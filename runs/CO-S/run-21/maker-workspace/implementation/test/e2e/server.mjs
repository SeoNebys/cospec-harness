import { rm } from 'node:fs/promises';

const dataFile = process.env.KEEPWELL_DATA_FILE || '/tmp/keepwell-e2e-bookmarks.json';
await rm(dataFile, { force: true });
await rm(`${dataFile}.tmp`, { force: true });
const { createServer } = await import('../../server.mjs');
const port = Number(process.env.PORT || 4100);
const host = process.env.HOST || '127.0.0.1';
createServer().listen(port, host, () => console.log(`Keepwell E2E listening on http://${host}:${port}`));
