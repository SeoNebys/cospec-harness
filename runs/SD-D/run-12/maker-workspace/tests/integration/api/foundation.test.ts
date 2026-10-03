import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, type TestApp } from '../../fixtures/app.js';

describe('application foundation', () => {
  let testApp: TestApp | undefined;
  afterEach(() => testApp?.cleanup());

  it('reports database readiness', async () => {
    testApp = createTestApp();
    const response = await request(testApp.app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
  });

  it('returns a stable problem envelope for unknown API routes', async () => {
    testApp = createTestApp();
    const response = await request(testApp.app).get('/api/missing');
    expect(response.status).toBe(404);
    expect(response.type).toContain('application/problem+json');
    expect(response.body).toMatchObject({ status: 404, code: 'not_found' });
  });
});
