import { z } from 'zod';

export const urlSchema = z.string().trim().max(4096).refine((value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}, 'Enter a valid http or https address without embedded credentials');
export const titleSchema = z.string().trim().min(1, 'Title is required').max(200);
export const tagNameSchema = z.string().trim().min(1).max(40);
export const tagsSchema = z.array(tagNameSchema).max(20).transform((items) => [...new Map(items.map((x) => [x.toLocaleLowerCase(), x])).values()]);
