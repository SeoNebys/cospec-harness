import type { Preferences } from '../../../shared/api/types.js';
import { BaseRepository } from './base-repository.js';

export class PreferenceRepository extends BaseRepository {
  get(): Preferences { const row = this.db.prepare('SELECT sort_field,sort_direction FROM preferences WHERE id=1').get() as any; return { sortField: row.sort_field, sortDirection: row.sort_direction }; }
  update(fields: Partial<Preferences>): Preferences {
    const current = this.get(); const next = { ...current, ...fields };
    this.db.prepare('UPDATE preferences SET sort_field=?,sort_direction=?,updated_at=? WHERE id=1').run(next.sortField,next.sortDirection,this.now());
    return next;
  }
}
