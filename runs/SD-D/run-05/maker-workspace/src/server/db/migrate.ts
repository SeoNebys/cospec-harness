import { migrate, db } from "./client";
migrate(); db.close(); console.log("Database ready");
