import { seedReviewUsers } from "../app/auth/review-seed.server";
import { migrateDatabase } from "../app/db/migrate.server";
import { sqlite } from "../app/db/client.server";

migrateDatabase();
const users = await seedReviewUsers();
console.log("Review identities are ready:");
for (const user of users) console.log(`- ${user.email} / ${user.password}`);
sqlite.close();
