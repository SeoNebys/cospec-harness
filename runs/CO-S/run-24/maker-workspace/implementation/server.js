// Production entry point. Starts the bookmark app on 0.0.0.0:4000.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./src/store.js";
import { createHttpServer } from "./src/app.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = process.env.DATA_FILE || join(__dirname, "data", "links.json");

const store = new Store(DATA_FILE);
await store.load();

const server = createHttpServer({ store });
server.listen(PORT, HOST, () => {
  console.log(`Bookmark app listening on http://${HOST}:${PORT} (data: ${DATA_FILE})`);
});
