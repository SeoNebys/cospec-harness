import { loadConfig } from "../src/server/config.js";
import { createDatabase } from "../src/server/db/client.js";
import { runMigrations } from "../src/server/db/migrate.js";
import { BookmarkSearchRepository } from "../src/server/repositories/bookmark-search-repository.js";

const db = createDatabase(loadConfig().databasePath);
runMigrations(db);
db.transaction(() => new BookmarkSearchRepository(db).rebuild())();
db.close();
