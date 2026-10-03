import { z } from "zod";

export const bookmarkInput = z.object({
  url: z.string().trim().min(1).max(4096),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(1000).default(""),
  note: z.string().trim().max(20000).default(""),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  isRead: z.boolean().default(true),
  isFavorite: z.boolean().default(false),
  iconUrl: z.string().max(4096).nullable().default(null)
});

export const searchInput = z.string().max(2000);
