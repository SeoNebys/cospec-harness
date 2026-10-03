import { createApp } from './src/app.js';

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

const app = createApp();
app.listen(PORT, HOST, () => {
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});
