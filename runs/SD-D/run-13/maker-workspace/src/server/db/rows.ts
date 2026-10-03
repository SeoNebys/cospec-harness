export function toIso(value: number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}
export function fromBoolean(value: number): boolean { return value === 1; }
