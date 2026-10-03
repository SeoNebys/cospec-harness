import type { AppDatabase } from "@/lib/db/client";
import { uuidv7 } from "@/lib/bookmarks/id";
import type { TagDto } from "@/lib/bookmarks/types";

export function normalizeTagName(value: string): { name: string; normalized: string } {
  const name = value.trim().replace(/\s+/g, " ").normalize("NFKC");
  if (!name || [...name].length > 50) throw new Error("TAG_INVALID");
  return { name, normalized: name.toLocaleLowerCase("en-US") };
}

export function ensureTags(database: AppDatabase, userId: string, values: string[]): TagDto[] {
  if (values.length > 25) throw new Error("TOO_MANY_TAGS");
  const unique = [...new Map(values.map(normalizeTagName).map((item) => [item.normalized, item])).values()];
  const count = (database.prepare("SELECT count(*) count FROM tags WHERE user_id = ?").get(userId) as { count: number }).count;
  const result: TagDto[] = [];
  const find = database.prepare("SELECT id, name FROM tags WHERE user_id = ? AND normalized_name = ?");
  const insert = database.prepare("INSERT INTO tags(id,user_id,name,normalized_name,created_at) VALUES (?,?,?,?,?)");
  let created = 0;
  for (const item of unique) {
    let row = find.get(userId, item.normalized) as TagDto | undefined;
    if (!row) {
      if (count + created >= 500) throw new Error("TAG_LIMIT");
      row = { id: uuidv7(), name: item.name };
      insert.run(row.id, userId, row.name, item.normalized, new Date().toISOString()); created++;
    }
    result.push(row);
  }
  return result;
}
