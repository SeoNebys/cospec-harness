import { ensureDatabase, client } from "../lib/db/client";
await ensureDatabase(); console.log("Database schema is ready."); await client.close();
