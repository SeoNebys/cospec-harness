import { z } from "zod";
import { positiveId } from "./common.js";

export const bookmarkQuerySchema = z.object({
  q: z.string().trim().max(300).default(""),
  folderId: positiveId.optional(),
  tagId: positiveId.optional(),
  favorite: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sort: z.enum(["newest", "oldest", "title"]).default("newest"),
  cursor: z.string().max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export function encodeCursor(value: { sortValue: string | number; id: number }): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor(value: string): { sortValue: string | number; id: number } {
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
  return z.object({ sortValue: z.union([z.string(), z.number()]), id: z.number().int().positive() }).parse(parsed);
}
