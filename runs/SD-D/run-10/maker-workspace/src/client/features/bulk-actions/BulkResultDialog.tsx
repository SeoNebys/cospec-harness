export type BulkResult = {
  selectedCount: number;
  succeededCount: number;
  failedCount: number;
  failures: Array<{ id: string; message: string }>;
};
export function BulkResultDialog({ result, onClose }: { result: BulkResult; onClose(): void }) {
  const dialogRef = useDialogFocus<HTMLElement>(onClose);
  return (
    <div className="confirm-overlay">
      <section
        ref={dialogRef}
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-result-title"
      >
        <p className="eyebrow">Action complete</p>
        <h2 id="bulk-result-title">
          {result.succeededCount} changed · {result.failedCount} unchanged
        </h2>
        <p>{result.selectedCount} selected bookmarks were accounted for.</p>
        {result.failures.length > 0 && (
          <ul>
            {result.failures.map((f) => (
              <li key={f.id}>{f.message}</li>
            ))}
          </ul>
        )}
        <button className="button button--primary" onClick={onClose}>
          Done
        </button>
      </section>
    </div>
  );
}
import { useDialogFocus } from '../../components/useDialogFocus';
