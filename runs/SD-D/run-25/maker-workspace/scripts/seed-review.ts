import { hash } from "@node-rs/argon2";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { getConfig } from "../src/lib/config";

const config = getConfig();
const sqlite = new Database(path.resolve(config.DATABASE_PATH));
sqlite.pragma("foreign_keys = ON");
const email = "review@example.com";
const password = "Review-password-2026!";
let row = sqlite.prepare('SELECT id FROM "user" WHERE email = ?').get(email) as { id: string } | undefined;
if (!row) {
  row = { id: randomUUID() };
  const now = Date.now();
  const passwordHash = await hash(password, { memoryCost: 19 * 1024, timeCost: 2, parallelism: 1, outputLen: 32 });
  sqlite.transaction(() => {
    sqlite.prepare('INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(row!.id, "Review Friend", email, 1, now, now);
    sqlite.prepare('INSERT INTO "account" (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(randomUUID(), row!.id, "credential", row!.id, passwordHash, now, now);
  })();
}

const examples = [
  { url: "https://developer.mozilla.org/en-US/docs/Web/Accessibility", title: "Accessibility on the web", description: "Practical guidance for building experiences that work for everyone.", tags: ["design", "reference"], reading: "unread", note: "## Why I saved this\n\nUse this as a **checklist** before shipping new interfaces." },
  { url: "https://www.rfc-editor.org/rfc/rfc3986", title: "URI Generic Syntax", description: "The standard reference for how web addresses are structured.", tags: ["reference", "web"], reading: "read", note: "> Keep URL normalization conservative.\n\nDifferent query strings can mean different resources." },
  { url: "https://example.com/slow-reading", title: "A long read for later", description: "A placeholder article in the reading queue.", tags: ["reading"], reading: "unread", note: null },
];

for (const [index, item] of examples.entries()) {
  const exists = sqlite.prepare("SELECT id FROM bookmarks WHERE user_id=? AND normalized_url=?").get(row.id, item.url) as { id: string } | undefined;
  if (exists) continue;
  const id = randomUUID();
  const now = Date.now() - index * 86_400_000;
  sqlite.prepare(`INSERT INTO bookmarks (id,user_id,url,normalized_url,normalization_version,title,title_user_edited,page_description,description_user_edited,note_markdown,note_plain_text,reading_state,metadata_status,created_at,updated_at) VALUES (?,?,?,?,1,?,1,?,1,?,?,?,?,?,?)`).run(id, row.id, item.url, item.url, item.title, item.description, item.note, item.note?.replaceAll(/[#*>`]/g, "") ?? "", item.reading, "complete", now, now);
  for (const tagName of item.tags) {
    let tag = sqlite.prepare("SELECT id FROM tags WHERE user_id=? AND normalized_name=?").get(row.id, tagName) as { id: string } | undefined;
    if (!tag) { tag = { id: randomUUID() }; sqlite.prepare("INSERT INTO tags (id,user_id,display_name,normalized_name,created_at) VALUES (?,?,?,?,?)").run(tag.id, row.id, tagName, tagName, now); }
    sqlite.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id,tag_id) VALUES (?,?)").run(id, tag.id);
  }
  const tagText = item.tags.join(" ");
  sqlite.prepare("INSERT INTO bookmark_search (bookmark_id,user_id,title,url,page_description,note_text,tag_text) VALUES (?,?,?,?,?,?,?)").run(id, row.id, item.title, item.url, item.description, item.note ?? "", tagText);
}
sqlite.close();
process.stdout.write(`Review account ready: ${email} / ${password}\n`);
