export function normalizeForSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("und").trim().replace(/\s+/gu, " ");
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
