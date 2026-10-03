import { randomUUID } from 'node:crypto';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
}

export const systemClock: Clock = { now: () => new Date() };
export const systemIds: IdGenerator = { uuid: randomUUID };

export interface RuntimeDependencies {
  clock: Clock;
  ids: IdGenerator;
}

export const systemRuntime: RuntimeDependencies = { clock: systemClock, ids: systemIds };

export function toUtcTimestamp(clock: Clock): string {
  return clock.now().toISOString();
}
