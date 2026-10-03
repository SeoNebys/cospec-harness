import { createApp } from './app.js';
import { loadConfig } from './config/index.js';

const config = loadConfig();
const { app, close } = await createApp(config);
const server = app.listen(config.port, config.host, () => {
  console.log(`Larder listening on http://${config.host}:${config.port}`);
});

const shutdown = () =>
  server.close(() => {
    close();
    process.exit(0);
  });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
