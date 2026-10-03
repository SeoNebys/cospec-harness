import { z } from 'zod';

export const noteMarkdownSchema = z.string().max(100_000).nullable();
export const noteAllowedElements = ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'a'] as const;
