export type Clock = { now(): Date };
export const systemClock: Clock = { now: () => new Date() };
export const toUtcIso = (date: Date) => date.toISOString();
