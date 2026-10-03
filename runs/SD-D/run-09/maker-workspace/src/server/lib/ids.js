import { ulid } from 'ulid';

// Opaque, monotonic, sortable ID for all entities.
export function newId() {
  return ulid();
}
