import { createServer } from 'node:http';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

let metadataProvider;
if (process.env.BOOKMARKS_METADATA_MODE === 'fixture') {
  metadataProvider = async url => {
    const hostName = new URL(url).hostname.replace(/^www\./, '');
    const potato = hostName.includes('seriouseats.com');
    return {
      title: potato ? 'The Best Crispy Roast Potatoes Ever' : `A useful page from ${hostName}`,
      description: potato
        ? 'Crunchy shells and fluffy centers make these the perfect roast potatoes.'
        : 'A saved page with details collected automatically.',
      siteName: potato ? 'Serious Eats' : hostName,
      faviconUrl: null,
      fallback: false
    };
  };
}

const { app, store } = createApp({
  dbFile: process.env.BOOKMARKS_DB,
  metadataProvider
});
const server = createServer(app);

server.listen(port, host, () => {
  console.log(`Bookmarks is ready at http://${host}:${port}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

