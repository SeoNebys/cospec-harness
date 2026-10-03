import { z } from 'zod';
export const noteSchema = z.string().max(2000);
