type LogLevel = "info" | "warn" | "error";
const sensitive = /password|secret|token|authorization|cookie/i;

function sanitize(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (sensitive.test(key)) return [key, "[redacted]"];
    if (key.toLowerCase().includes("url") && typeof value === "string") {
      try {
        const url = new URL(value);
        return [key, `${url.protocol}//${url.host}${url.pathname}`];
      } catch {
        return [key, "[invalid-url]"];
      }
    }
    return [key, value];
  }));
}

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ level, event, ...sanitize(fields) });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
