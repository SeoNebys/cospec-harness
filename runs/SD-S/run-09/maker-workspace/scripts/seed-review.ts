import { loadConfig } from "../src/server/config.js";
import { createDatabase } from "../src/server/db/client.js";
import { runMigrations } from "../src/server/db/migrate.js";
import { createAuth } from "../src/server/auth/auth.js";
import { ConsoleMailer } from "../src/server/mail/test-mailer.js";

const config = loadConfig();
if (config.nodeEnv === "production") throw new Error("Review seeding is disabled in production");
if (!config.review.enabled) {
  console.info("Review seed skipped; set REVIEW_SEED=true to enable it.");
  process.exit(0);
}
const db = createDatabase(config.databasePath);
runMigrations(db);
const existing = db.prepare("SELECT id FROM user WHERE email=?").get(config.review.email);
if (!existing) {
  const auth = createAuth(db, config, new ConsoleMailer());
  await auth.api.signUpEmail({ body: { name: config.review.name, email: config.review.email, password: config.review.password } });
  console.info(`Created review account ${config.review.email}`);
} else {
  console.info(`Review account ${config.review.email} already exists`);
}
db.close();
