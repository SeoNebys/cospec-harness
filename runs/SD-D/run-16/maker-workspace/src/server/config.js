// Central runtime configuration for the Bookmark Manager server.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 4000),
  repoRoot,
  webDir: path.join(repoRoot, 'src', 'web'),
  dataDir: process.env.DATA_DIR || path.join(repoRoot, 'data'),
  get dbFile() {
    return process.env.DB_FILE || path.join(this.dataDir, 'bookmarks.db');
  },
  get preservedDir() {
    return path.join(this.dataDir, 'preserved');
  },
  // Network timeouts (ms) for outbound features that must degrade gracefully.
  fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS || 10000),
  preserveTimeoutMs: Number(process.env.PRESERVE_TIMEOUT_MS || 60000),
};
