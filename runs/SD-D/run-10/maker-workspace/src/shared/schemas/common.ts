import { z } from 'zod';

export const publicIdSchema = z.string().min(8).max(80);
export const expectedVersionSchema = z.number().int().positive();
export const emailSchema = z.string().trim().email().max(320);
export const passwordSchema = z.string().min(12).max(128);
export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  code: z.string().optional(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        code: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  requestId: z.string().optional(),
});

export type Problem = z.infer<typeof problemSchema>;
