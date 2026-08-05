// Comfort + capture settings (SCN-016 off-switch; Slice 7 comfort knobs).
// Pure helpers here; persistence (localStorage) and DOM application live in the
// pages, but these keep the mapping testable and consistent.

export const DEFAULTS = { theme: 'light', textSize: 'm', keepCopies: true };

export function normalizeTheme(t) { return t === 'dark' ? 'dark' : 'light'; }
export function normalizeSize(s) { return ['s', 'm', 'l'].includes(s) ? s : 'm'; }

// Text-size comfort knob → a zoom factor applied to the reading area.
export function zoomFor(size) { return size === 's' ? 0.92 : size === 'l' ? 1.14 : 1; }
