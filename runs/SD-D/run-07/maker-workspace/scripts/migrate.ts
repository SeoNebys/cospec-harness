import { openDatabase } from "../lib/db/connection";
import { migrate } from "../lib/db/migrate";
const db = openDatabase(); migrate(db); db.close(); console.log("Database is ready.");
