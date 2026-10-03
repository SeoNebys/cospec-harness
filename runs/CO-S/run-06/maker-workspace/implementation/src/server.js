// Production entry point. Starts the HTTP server on 0.0.0.0:4000.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultApp } from "./app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = process.env.DATA_FILE || join(__dirname, "..", "data", "bookmarks.json");

const app = createDefaultApp(DATA_FILE);
app.listen(PORT, HOST, () => {
  console.log(`Bookmark manager listening on http://${HOST}:${PORT}`);
});
