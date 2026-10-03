import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/connection.js';

export interface RuntimeValues {
  now: () => Date;
  uuid: () => string;
}

export const runtimeValues: RuntimeValues = { now: () => new Date(), uuid: randomUUID };
export const timestamp = (runtime: RuntimeValues = runtimeValues): string => runtime.now().toISOString();
export const publicId = (runtime: RuntimeValues = runtimeValues): string => runtime.uuid();
export const inTransaction = <T>(db: AppDatabase, work: () => T): T => db.transaction(work)();
export const pageOffset = (page: number, pageSize: number): number => (page - 1) * pageSize;
