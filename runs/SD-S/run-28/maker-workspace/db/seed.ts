import { auth } from "@/lib/auth/server";
import { env } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";

const config=env();migrate(getDb());
if(config.SEED_REVIEW_USER!=="true"){console.log("Review seed disabled. Set SEED_REVIEW_USER=true to enable it.");process.exit(0);}
const email="reviewer@example.com";
const existing=getDb().prepare('SELECT id FROM "user" WHERE lower(email)=lower(?)').get(email);
if(existing){console.log(`Review account already exists: ${email}`);process.exit(0);}
await auth.api.signUpEmail({body:{name:"Review User",email,password:"Review-Bookmark-2026!"}});
console.log(`Created review account: ${email}`);
