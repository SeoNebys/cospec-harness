export const DEFAULT_TEST_TIME = "2026-01-02T03:04:05.000Z";

export interface ClockAdvance {
  milliseconds?: number;
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
}

function toMilliseconds(advance: number | ClockAdvance): number {
  if (typeof advance === "number") return advance;

  return (
    (advance.milliseconds ?? 0) +
    (advance.seconds ?? 0) * 1_000 +
    (advance.minutes ?? 0) * 60_000 +
    (advance.hours ?? 0) * 3_600_000 +
    (advance.days ?? 0) * 86_400_000
  );
}

function parseTime(value: string | number | Date): number {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError(`Invalid test clock value: ${String(value)}`);
  }
  return milliseconds;
}

/** A mutable clock whose returned Dates cannot mutate its internal state. */
export class TestClock {
  #milliseconds: number;

  constructor(initialTime: string | number | Date = DEFAULT_TEST_TIME) {
    this.#milliseconds = parseTime(initialTime);
  }

  readonly now = (): Date => new Date(this.#milliseconds);

  iso(): string {
    return this.now().toISOString();
  }

  set(value: string | number | Date): Date {
    this.#milliseconds = parseTime(value);
    return this.now();
  }

  advance(by: number | ClockAdvance): Date {
    const milliseconds = toMilliseconds(by);
    if (!Number.isFinite(milliseconds)) {
      throw new TypeError("Test clock advance must be finite");
    }
    this.#milliseconds += milliseconds;
    return this.now();
  }
}

export function createTestClock(
  initialTime: string | number | Date = DEFAULT_TEST_TIME,
): TestClock {
  return new TestClock(initialTime);
}

export function fixedNow(value: string | number | Date = DEFAULT_TEST_TIME): () => Date {
  const milliseconds = parseTime(value);
  return () => new Date(milliseconds);
}
