import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createDb } from "./db.js";
import { createBookmarkModel } from "./models/bookmark.js";
import { fetchTitle } from "./services/titleFetcher.js";
import { createBookmarksRouter } from "./api/bookmarks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build the Express app. Dependencies are injected so tests can supply an
 * in-memory model and a stubbed title fetcher.
 */
export function createApp({ model, titleFetcher = fetchTitle } = {}) {
  const app = express();
  app.use(express.json());

  // Static frontend
  app.use(express.static(join(__dirname, "..", "web")));

  // API
  app.use("/api", createBookmarksRouter({ model, titleFetcher }));

  // Centralized error handler -> { error }
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

// Start the server only when run directly (not when imported by tests).
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const db = createDb();
  const model = createBookmarkModel(db);
  const app = createApp({ model });
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Bookmark Manager running at http://localhost:${port}`);
  });
}
