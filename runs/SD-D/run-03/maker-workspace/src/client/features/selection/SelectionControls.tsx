import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeExactTag } from "../../../shared/search/tokenizer";
import { Button, Status } from "../../components";
import {
  ApiError,
  api,
  type BookmarkApiClient,
  type SearchCriteria,
  type Selection,
  type SelectionCreate,
} from "../../lib/api";

export interface SelectableBookmark {
  id: number;
  title: string;
}

export interface SelectionControlsProps {
  visibleBookmarks: readonly SelectableBookmark[];
  totalResults: number;
  criteria: SearchCriteria;
  client?: BookmarkApiClient | undefined;
  onSelectionChange: (selection: Selection | null) => void;
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/** Browser-safe SHA-256 used to match the server's exact criteria snapshot identity. */
function sha256(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);

  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0;
      const previous2 = words[index - 2] ?? 0;
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0;
    }

    let a = hash[0] ?? 0;
    let b = hash[1] ?? 0;
    let c = hash[2] ?? 0;
    let d = hash[3] ?? 0;
    let e = hash[4] ?? 0;
    let f = hash[5] ?? 0;
    let g = hash[6] ?? 0;
    let h = hash[7] ?? 0;
    for (let index = 0; index < 64; index += 1) {
      const upper1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 =
        (h + upper1 + choose + (constants[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const upper0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (upper0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }

  return Array.from(hash, (word) => word.toString(16).padStart(8, "0")).join("");
}

export function computeClientCriteriaHash(criteria: SearchCriteria): string {
  const canonical = {
    scope: criteria.scope,
    query: criteria.query,
    tags: [...new Set(criteria.tags.map(normalizeExactTag))].sort(),
    favorite: criteria.favorite ?? null,
    unread: criteria.unread ?? null,
    sort: criteria.sort,
  };
  return `sha256:${sha256(JSON.stringify(canonical))}`;
}

export function SelectionControls({
  visibleBookmarks,
  totalResults,
  criteria,
  client = api,
  onSelectionChange,
}: SelectionControlsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [allResults, setAllResults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectionRef = useRef<Selection | null>(null);
  const revisionRef = useRef(0);
  const effectiveHash = computeClientCriteriaHash(criteria);
  const viewKey = useMemo(
    () => `${effectiveHash}:${JSON.stringify(criteria)}`,
    [criteria, effectiveHash],
  );
  const previousViewKey = useRef(viewKey);

  function storeSelection(next: Selection | null) {
    selectionRef.current = next;
    setSelection(next);
    onSelectionChange(next);
  }

  useEffect(() => {
    if (previousViewKey.current === viewKey) return;
    previousViewKey.current = viewKey;
    revisionRef.current += 1;
    const stale = selectionRef.current;
    selectionRef.current = null;
    setSelection(null);
    setSelectedIds(new Set());
    setAllResults(false);
    setError("");
    onSelectionChange(null);
    if (stale) void client.clearSelection(stale.id).catch(() => undefined);
  }, [client, onSelectionChange, viewKey]);

  async function replaceSelection(input: SelectionCreate, ids: Set<number>, everyResult: boolean) {
    const revision = ++revisionRef.current;
    const stale = selectionRef.current;
    setSelectedIds(ids);
    setAllResults(everyResult);
    setBusy(true);
    setError("");
    try {
      if (stale) await client.clearSelection(stale.id);
      const created = await client.createSelection(input);
      if (revision !== revisionRef.current) {
        await client.clearSelection(created.id).catch(() => undefined);
        return;
      }
      storeSelection(created);
    } catch (cause) {
      if (revision !== revisionRef.current) return;
      storeSelection(null);
      setSelectedIds(new Set());
      setAllResults(false);
      setError(
        cause instanceof ApiError
          ? cause.problem.message
          : "The selection could not be created. Please try again.",
      );
    } finally {
      if (revision === revisionRef.current) setBusy(false);
    }
  }

  async function clearCurrent() {
    const revision = ++revisionRef.current;
    const stale = selectionRef.current;
    setSelectedIds(new Set());
    setAllResults(false);
    setBusy(Boolean(stale));
    setError("");
    storeSelection(null);
    if (!stale) return;
    try {
      await client.clearSelection(stale.id);
    } catch (cause) {
      if (revision === revisionRef.current) {
        setError(
          cause instanceof ApiError
            ? cause.problem.message
            : "The selection could not be cleared. Please try again.",
        );
      }
    } finally {
      if (revision === revisionRef.current) setBusy(false);
    }
  }

  function toggle(id: number, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    if (next.size === 0) {
      void clearCurrent();
      return;
    }
    void replaceSelection(
      {
        mode: "ids",
        ids: [...next].sort((left, right) => left - right),
        criteriaHash: effectiveHash,
      },
      next,
      false,
    );
  }

  const selectedCount = selection?.selectedCount ?? selectedIds.size;
  const allVisibleSelected =
    visibleBookmarks.length > 0 &&
    visibleBookmarks.every((bookmark) => selectedIds.has(bookmark.id));
  const notVisibleCount = Math.max(0, totalResults - visibleBookmarks.length);

  return (
    <section className="selection-controls" aria-label="Select bookmarks">
      <div className="selection-controls__summary">
        <div role="status" aria-label="Selection count" aria-live="polite" aria-atomic="true">
          {selectedCount} bookmark{selectedCount === 1 ? "" : "s"} selected
        </div>
        <div className="selection-controls__buttons">
          <Button
            size="small"
            disabled={busy || visibleBookmarks.length === 0 || allVisibleSelected}
            onClick={() => {
              const ids = new Set(visibleBookmarks.map((bookmark) => bookmark.id));
              void replaceSelection(
                { mode: "ids", ids: [...ids], criteriaHash: effectiveHash },
                ids,
                false,
              );
            }}
          >
            Select {visibleBookmarks.length} on this page
          </Button>
          {totalResults > visibleBookmarks.length ? (
            <Button
              size="small"
              variant="secondary"
              disabled={busy || allResults}
              onClick={() =>
                void replaceSelection(
                  { mode: "all_results", criteria, criteriaHash: effectiveHash },
                  new Set(visibleBookmarks.map((bookmark) => bookmark.id)),
                  true,
                )
              }
            >
              Select all {totalResults} results
            </Button>
          ) : null}
          {selectedCount > 0 ? (
            <Button size="small" variant="quiet" disabled={busy} onClick={clearCurrent}>
              Clear selection
            </Button>
          ) : null}
        </div>
      </div>

      <fieldset className="selection-controls__items" disabled={busy}>
        <legend>Choose individual bookmarks</legend>
        {visibleBookmarks.map((bookmark) => (
          <label key={bookmark.id}>
            <input
              type="checkbox"
              checked={allResults || selectedIds.has(bookmark.id)}
              onChange={(event) => toggle(bookmark.id, event.currentTarget.checked)}
            />
            Select {bookmark.title}
          </label>
        ))}
      </fieldset>

      {allResults && selection ? (
        <p className="selection-controls__explanation">
          All {selection.selectedCount} current results are selected. This includes{" "}
          {notVisibleCount} result{notVisibleCount === 1 ? "" : "s"} not shown on this page. Later
          collection changes will not alter this snapshot.
        </p>
      ) : null}
      {busy ? <Status>Updating selection…</Status> : null}
      {error ? <Status tone="error">{error}</Status> : null}
    </section>
  );
}
