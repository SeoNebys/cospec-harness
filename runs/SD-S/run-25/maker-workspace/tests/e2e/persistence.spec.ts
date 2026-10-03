import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { expect, test } from '@playwright/test';

async function availablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('No test port.'));
      server.close(() => resolve(address.port));
    });
  });
}

async function startProductionServer(port: number, databasePath: string) {
  const logs: string[] = [];
  const child = spawn('npm', ['start'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: databasePath,
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr?.on('data', (chunk) => logs.push(String(chunk)));

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production server stopped early: ${logs.join('')}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return child;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  stopServer(child);
  throw new Error(`Production server did not become ready: ${logs.join('')}`);
}

function stopServer(child: ChildProcess): void {
  if (child.pid && child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

async function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Production server did not stop.')), 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

test('keeps bookmarks after a production-process restart', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'trove-restart-'));
  const databasePath = path.join(directory, 'bookmarks.sqlite');
  const port = await availablePort();
  let server: ChildProcess | undefined;

  try {
    server = await startProductionServer(port, databasePath);
    const created = await fetch(`http://127.0.0.1:${port}/api/bookmarks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.test/restart-proof',
        title: 'Restart-proof bookmark',
        tags: ['Persistence'],
        readingState: 'to_read',
      }),
    });
    expect(created.status).toBe(201);
    stopServer(server);
    await waitForExit(server);

    server = await startProductionServer(port, databasePath);
    const response = await fetch(`http://127.0.0.1:${port}/api/bookmarks?view=read-later`);
    expect(response.ok).toBeTruthy();
    const list = (await response.json()) as { items: Array<{ title: string }> };
    expect(list.items.map(({ title }) => title)).toContain('Restart-proof bookmark');
  } finally {
    if (server) stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }
});
