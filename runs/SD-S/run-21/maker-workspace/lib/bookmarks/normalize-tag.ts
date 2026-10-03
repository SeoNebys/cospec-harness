export function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
export function displayTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
