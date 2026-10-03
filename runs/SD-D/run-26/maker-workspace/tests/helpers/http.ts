import request from 'supertest';
import { createApp } from '@server/app.js';
import type { AppConfig } from '@server/config/index.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
export async function testApp() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'larder-http-'));
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 4000,
    dataDir,
    passwordHash: undefined,
    developmentPassword: 'review-bookmarks',
    cookieSecure: false,
    trustProxy: false,
    logLevel: 'silent',
    production: false
  };
  const created = await createApp(config);
  const agent = request.agent(created.app);
  const login = await agent.post('/api/session').send({ password: 'review-bookmarks' }).expect(200);
  const csrf = login.body.csrfToken as string;
  return {
    ...created,
    agent,
    csrf,
    cleanup() {
      created.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  };
}
