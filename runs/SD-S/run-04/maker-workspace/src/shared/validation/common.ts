import { z } from 'zod';

export const emailSchema = z.string().trim().email().min(3).max(254);
export const passwordSchema = z.string().min(12).max(128);
export const idSchema = z.string().uuid();

export const credentialsSchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .strict();
export type Credentials = z.infer<typeof credentialsSchema>;
