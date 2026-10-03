import { ensureDatabase, client } from "../lib/db/client";
await ensureDatabase(); console.log("Database ready; create a review account in the application."); await client.close();
