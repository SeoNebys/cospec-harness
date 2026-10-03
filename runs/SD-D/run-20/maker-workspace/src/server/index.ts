import { buildApp } from './app.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 4000);
const app = await buildApp({ logger: true });
await app.listen({ host, port });

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void app.close());
