import type { ZodError } from 'zod';
export function zodFieldErrors(error: ZodError) {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) { const key = String(issue.path[0] ?? 'request'); (out[key] ??= []).push(issue.message); }
  return out;
}
