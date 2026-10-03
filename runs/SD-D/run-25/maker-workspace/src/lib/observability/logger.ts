type LogLevel = "info" | "warn" | "error";

const PRIVATE_KEYS = new Set(["url", "note", "password", "token", "session", "csrf", "email"]);

function safeFields(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !PRIVATE_KEYS.has(key.toLowerCase())));
}

function write(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const entry = { timestamp: new Date().toISOString(), level, event, ...safeFields(fields) };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
