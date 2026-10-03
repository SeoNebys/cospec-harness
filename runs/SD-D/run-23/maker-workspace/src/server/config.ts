import path from 'node:path';

try {
  process.loadEnvFile?.();
} catch {
  // A checked-in .env is intentionally optional; production injects variables.
}

const root = process.cwd();

export const config = {
  host: process.env.APP_HOST || '0.0.0.0',
  port: Number(process.env.APP_PORT || 4000),
  databasePath: path.resolve(root, process.env.DATABASE_PATH || './data/bookmarks.db'),
  mediaCachePath: path.resolve(root, process.env.MEDIA_CACHE_PATH || './data/media-cache'),
  sessionKey: process.env.SESSION_KEY || 'local-review-session-key-change-me-now',
  reviewEmail: (process.env.REVIEW_USER_EMAIL || 'review@example.test').trim().toLowerCase(),
  reviewPassword: process.env.REVIEW_USER_PASSWORD || 'bookmark-review',
  isProduction: process.env.NODE_ENV === 'production',
  metadata: {
    deadlineMs: 4500,
    maxRedirects: 5,
    maxHtmlBytes: 2 * 1024 * 1024,
    maxIconBytes: 512 * 1024,
    maxPreviewBytes: 5 * 1024 * 1024,
  },
};

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error('APP_PORT must be a valid port number');
}
if (config.sessionKey.length < 32) throw new Error('SESSION_KEY must contain at least 32 characters');
