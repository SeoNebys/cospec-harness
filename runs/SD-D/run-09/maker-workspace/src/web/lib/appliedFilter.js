// Tiny module-level store so "Apply filter" from the Filters view can seed the
// All view's initial search + tag include/exclude.
let applied = null;

export function setAppliedFilter(f) {
  applied = f;
}
export function takeAppliedFilter() {
  const f = applied;
  applied = null;
  return f;
}
