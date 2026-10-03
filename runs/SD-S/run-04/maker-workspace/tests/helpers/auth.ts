import request from 'supertest';
import type { Express } from 'express';

let counter = 0;
export async function authenticated(app: Express, email?: string) {
  const agent = request.agent(app);
  counter += 1;
  await agent
    .post('/api/auth/register')
    .send({
      email: email ?? `person${counter}@example.com`,
      password: 'correct horse battery staple',
    })
    .expect(201);
  return agent;
}
