import type { PrismaClient } from "../../generated/prisma/client";
import { db } from "../db/client";

export type TagCount = { id: number; name: string; count: number };

export async function listTags(client: PrismaClient = db): Promise<TagCount[]> {
  const rows = await client.tag.findMany({
    where: { bookmarks: { some: {} } },
    include: { _count: { select: { bookmarks: true } } },
    orderBy: { nameKey: "asc" },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, count: row._count.bookmarks }));
}
