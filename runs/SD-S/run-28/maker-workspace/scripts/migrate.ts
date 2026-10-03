import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";

const applied = migrate(getDb());
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is current.");
