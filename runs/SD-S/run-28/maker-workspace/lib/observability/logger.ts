type LogFields = Record<string, string | number | boolean | null | undefined>;

const forbidden = /password|token|secret|notes|query|body/i;

export function logEvent(event: string, fields: LogFields = {}): void {
  const safe = Object.fromEntries(Object.entries(fields).filter(([key]) => !forbidden.test(key)));
  console.info(JSON.stringify({ level: "info", event, at: new Date().toISOString(), ...safe }));
}
