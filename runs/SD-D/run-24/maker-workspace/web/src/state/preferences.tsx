import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { DisplayPreferences } from '../types';
import { getPreferences, updatePreferences } from '../api/client';

interface Ctx {
  prefs: DisplayPreferences | null;
  save: (p: Partial<DisplayPreferences>) => Promise<void>;
}

const PreferencesContext = createContext<Ctx>({ prefs: null, save: async () => undefined });

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPreferences | null>(null);

  useEffect(() => {
    getPreferences().then(setPrefs).catch(() => setPrefs({ default_sort: 'saved_desc', page_size: 50, text_size: 'medium' }));
  }, []);

  useEffect(() => {
    if (prefs) document.documentElement.dataset.textSize = prefs.text_size;
  }, [prefs]);

  async function save(patch: Partial<DisplayPreferences>) {
    const next = await updatePreferences(patch);
    setPrefs(next);
  }

  return <PreferencesContext.Provider value={{ prefs, save }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
