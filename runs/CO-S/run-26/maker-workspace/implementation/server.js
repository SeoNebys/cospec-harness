// Entry point for the personal bookmarks web app.
// Listens on 0.0.0.0:4000 for the review/runtime environment.

import { createApp } from "./src/app.js";
import { BookmarkStore } from "./src/store.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const HOST = process.env.HOST || "0.0.0.0";

const store = process.env.DATA_FILE
  ? new BookmarkStore(process.env.DATA_FILE)
  : new BookmarkStore();
await store.load();

const app = createApp({ store });

app.listen(PORT, HOST, () => {
  console.log(`Bookmarks app listening on http://${HOST}:${PORT}`);
});
