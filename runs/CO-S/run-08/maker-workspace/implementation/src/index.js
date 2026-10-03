'use strict';

const { createApp } = require('./server');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();
app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Bookmarks app listening on http://${HOST}:${PORT}`);
});
