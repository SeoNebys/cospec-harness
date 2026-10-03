import type { Bookmark } from "../../../shared/contracts/bookmarks.js";

export function DuplicateDialog({existing,onView,onSave,onCancel}:{existing:Pick<Bookmark,"id"|"title"|"url">;onView:()=>void;onSave:()=>void;onCancel:()=>void}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onCancel();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
    <div className="dialog-icon">↗</div><h2 id="duplicate-title">You’ve saved this before</h2><p className="muted">There’s already a bookmark for this address.</p><div className="duplicate-item"><strong>{existing.title}</strong><span>{existing.url}</span></div>
    <div className="dialog-actions"><button onClick={onCancel}>Cancel</button><button onClick={onView}>View existing</button><button className="primary" onClick={onSave}>Save another copy</button></div>
  </section></div>;
}
