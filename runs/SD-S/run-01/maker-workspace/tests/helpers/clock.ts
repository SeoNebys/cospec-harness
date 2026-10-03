export function createClock(...values: string[]): () => string {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? '2026-09-16T12:00:00.000Z';
}
