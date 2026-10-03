export function logError(context: string, error: unknown): void {
  const safe = error instanceof Error ? { name: error.name, message: error.message } : { message: "Unknown error" };
  console.error(JSON.stringify({ level: "error", context, ...safe }));
}
