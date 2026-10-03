import { createApp } from './app.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, host, () => {
  console.log(`Keepwell is listening on http://${host}:${port}`);
});
