// Bulk actions over an explicit selection or "all matching" the current query/filter.
import { getDb } from '../db/connection.js';
import { candidatesForSearch, listBookmarks, deleteBookmark } from './bookmarks.js';
import { addTagsToBookmark, removeTagsFromBookmark } from './tags.js';
import { parse } from './searchParser.js';
import { evaluate } from './searchEvaluator.js';

function resolveIds(select) {
  if (!select) return [];
  if (Array.isArray(select.ids)) return select.ids.map(Number);
  if (select.matching) {
    const { q = '', tag = null, view = 'normal' } = select.matching;
    const searchView = view === 'archived' ? 'archived' : view === 'unread' ? 'unread' : 'normal';
    if (q && q.trim()) {
      const ast = parse(q);
      const base = candidatesForSearch({ view: searchView === 'archived' ? 'archived' : searchView });
      return base.filter((b) => evaluate(ast, b)).map((b) => b.id);
    }
    return listBookmarks({ view: searchView, tag }).items.map((b) => b.id);
  }
  return [];
}

export function applyBulk({ select, action }) {
  if (!action || !action.type) {
    const e = new Error('A bulk action is required.');
    e.status = 400;
    e.code = 'bad_request';
    throw e;
  }
  const ids = resolveIds(select);
  if (action.type === 'delete' && action.confirm !== true) {
    const e = new Error('Bulk deletion must be confirmed.');
    e.status = 400;
    e.code = 'confirm_required';
    throw e;
  }
  const db = getDb();
  const nowIso = new Date().toISOString();
  const run = db.transaction((idList) => {
    let affected = 0;
    for (const id of idList) {
      switch (action.type) {
        case 'addTags':
          addTagsToBookmark(id, action.tags || []);
          db.prepare('UPDATE bookmarks SET date_updated = ? WHERE id = ?').run(nowIso, id);
          affected++;
          break;
        case 'removeTags':
          removeTagsFromBookmark(id, action.tags || []);
          db.prepare('UPDATE bookmarks SET date_updated = ? WHERE id = ?').run(nowIso, id);
          affected++;
          break;
        case 'setUnread':
          db.prepare('UPDATE bookmarks SET is_unread = ?, date_updated = ? WHERE id = ?').run(action.value ? 1 : 0, nowIso, id);
          affected++;
          break;
        case 'setArchived':
          db.prepare('UPDATE bookmarks SET is_archived = ?, date_updated = ? WHERE id = ?').run(action.value ? 1 : 0, nowIso, id);
          affected++;
          break;
        case 'delete':
          if (deleteBookmark(id)) affected++;
          break;
        default: {
          const e = new Error(`Unknown bulk action "${action.type}".`);
          e.status = 400;
          e.code = 'bad_request';
          throw e;
        }
      }
    }
    return affected;
  });
  return run(ids);
}
