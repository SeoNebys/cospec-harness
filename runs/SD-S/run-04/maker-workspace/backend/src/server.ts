import { createDatabase } from "./db/connection.js";
import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);
const DB_FILE = process.env.DB_FILE ?? "bookmarks.sqlite";

async function main() {
  const db = createDatabase(DB_FILE);
  const { app } = await buildApp({ db, logger: true });
  await app.listen({ port: PORT, host: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`Bookmark Manager API listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
