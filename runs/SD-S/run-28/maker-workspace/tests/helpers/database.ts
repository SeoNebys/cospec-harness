import type { AppDatabase } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";

export function testDatabase(): { db: AppDatabase; userId: string; otherUserId: string } {
  const db=createTestDb();migrate(db);
  const now=new Date().toISOString();
  const insert=db.prepare('INSERT INTO "user"(id,name,email,emailVerified,image,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)');
  insert.run("user-one","One","one@example.com",1,null,now,now);insert.run("user-two","Two","two@example.com",1,null,now,now);
  return{db,userId:"user-one",otherUserId:"user-two"};
}
