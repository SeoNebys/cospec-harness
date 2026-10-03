// Deterministic smoke-test runner. Starts a single server on a free port,
// waits until it is ready, runs the Playwright smoke suite against it (reusing
// the running server, so Playwright never spawns/tears down its own), then stops
// the server. This avoids the better-sqlite3 teardown flakiness that occurs when
// a server is spawned and killed repeatedly by Playwright's webServer.
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:4000';

// Start the smoke run from a clean database so a WAL/lock left by an earlier
// stage cannot interfere with server startup.
for (const f of ['data/bookmarks.db', 'data/bookmarks.db-wal', 'data/bookmarks.db-shm']) {
  try { fs.rmSync(f, { force: true }); } catch {}
}
// Build a clean environment. When this runner is invoked via `npm test`, npm
// injects NODE_OPTIONS / npm_* variables that, inherited by the spawned server,
// trip a better-sqlite3 native teardown assertion on this Node build. Strip them.
const cleanEnv = {};
for (const [k, v] of Object.entries(process.env)) {
  if (k === 'NODE_OPTIONS') continue;
  if (k.startsWith('npm_')) continue;
  cleanEnv[k] = v;
}
const env = {
  ...cleanEnv,
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/playwright-browsers',
};

async function ready() {
  try {
    const r = await fetch(`${BASE}/api/preferences`);
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (await ready()) {
    console.error('Port 4000 already in use; aborting smoke run.');
    process.exit(1);
  }

  // Launch via a shell (as the broker / `npm start` does). A Node process that
  // directly spawns another Node process trips a better-sqlite3 native
  // teardown assertion on this Node build; going through a shell avoids it.
  const server = spawn('bash', ['-c', 'exec node src/start.js'], {
    stdio: 'inherit',
    env,
    detached: true,
  });

  let up = false;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    if (await ready()) { up = true; break; }
  }
  if (!up) {
    try { process.kill(-server.pid); } catch {}
    console.error('Server did not become ready.');
    process.exit(1);
  }

  const result = spawnSync('npx', ['playwright', 'test', 'tests/smoke'], { stdio: 'inherit', env });

  // Stop the server group cleanly.
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  await sleep(500);
  try { process.kill(-server.pid, 'SIGKILL'); } catch {}

  process.exit(result.status === null ? 1 : result.status);
}

main();
