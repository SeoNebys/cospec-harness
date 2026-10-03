import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Config {
  host: string; port: number; dataDir: string; captureTimeoutMs: number;
  captureMaxHeight: number; captureConcurrency: number; allowPrivateCapture: boolean;
}

export function loadConfig(env = process.env): Config {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const dataDir = path.resolve(env.BOOKMARK_DATA_DIR ?? path.join(root, 'data'));
  const staticDir = path.resolve(root, 'apps/web/dist');
  if (dataDir === staticDir || dataDir.startsWith(`${staticDir}${path.sep}`)) throw new Error('BOOKMARK_DATA_DIR cannot be inside static assets');
  return {
    host: env.HOST ?? '0.0.0.0', port: Number(env.PORT ?? 4000), dataDir,
    captureTimeoutMs: Number(env.CAPTURE_TIMEOUT_MS ?? 25_000),
    captureMaxHeight: Number(env.CAPTURE_MAX_HEIGHT ?? 20_000),
    captureConcurrency: 2, allowPrivateCapture: env.ALLOW_PRIVATE_CAPTURE === 'true' && env.NODE_ENV === 'test'
  };
}
