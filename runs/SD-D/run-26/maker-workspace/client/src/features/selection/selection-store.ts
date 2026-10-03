export type SelectionState =
  | { mode: 'ids'; ids: Set<string> }
  | { mode: 'all'; queryFingerprint: string; excludeIds: Set<string> };
export const emptySelection = (): SelectionState => ({ mode: 'ids', ids: new Set() });
export function toggleSelection(
  state: SelectionState,
  id: string,
  selected: boolean
): SelectionState {
  if (state.mode === 'ids') {
    const ids = new Set(state.ids);
    selected ? ids.add(id) : ids.delete(id);
    return { ...state, ids };
  }
  const excludeIds = new Set(state.excludeIds);
  selected ? excludeIds.delete(id) : excludeIds.add(id);
  return { ...state, excludeIds };
}
