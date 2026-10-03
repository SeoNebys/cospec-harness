import { z } from "zod";

export const positiveId = z.coerce.number().int().positive();
export const optionalTrimmedNotes = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => [...value].length <= 10_000, "Notes must be 10,000 characters or fewer")
  .nullable()
  .optional();

export function codePointLength(value: string): number {
  return [...value].length;
}

export function normalizeDisplay(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}
