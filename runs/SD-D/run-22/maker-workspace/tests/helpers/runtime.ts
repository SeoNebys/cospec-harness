import type { Clock, IdGenerator, RuntimeDependencies } from '../../src/server/runtime.js';

export class FixedClock implements Clock {
  constructor(private current = new Date('2026-01-02T03:04:05.000Z')) {}
  now(): Date { return new Date(this.current); }
  set(value: Date | string): void { this.current = new Date(value); }
  advance(milliseconds: number): void { this.current = new Date(this.current.getTime() + milliseconds); }
}

export class SequenceIds implements IdGenerator {
  private cursor = 0;
  constructor(private readonly values = ['00000000-0000-4000-8000-000000000001']) {}
  uuid(): string {
    const value = this.values[this.cursor];
    if (!value) throw new Error('No deterministic UUID remains');
    this.cursor += 1;
    return value;
  }
}

export function deterministicRuntime(ids?: string[]): RuntimeDependencies {
  return { clock: new FixedClock(), ids: new SequenceIds(ids) };
}
