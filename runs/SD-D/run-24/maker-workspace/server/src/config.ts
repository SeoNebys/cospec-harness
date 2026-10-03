import path from 'path';
import fs from 'fs';

// Runtime configuration for the bookmark manager server.
export const HOST = '0.0.0.0';
export const PORT = Number(process.env.PORT) || 4000;

// Where the SPA build lands (vite outDir) and where runtime data lives.
export const ROOT_DIR = process.cwd();
export const WEB_DIST = path.join(ROOT_DIR, 'dist', 'web');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
export const CAPTURES_DIR = path.join(DATA_DIR, 'captures');
export const DB_PATH = path.join(DATA_DIR, 'bookmarks.db');

// Full-page local copies above this size are not stored (copy marked unavailable).
export const CAPTURE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// Shared Chromium provided by the image.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/playwright-browsers';
}

export function ensureDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}
