import { Router } from 'express';
import { getPreferences, updatePreferences, PreferencesError } from '../services/preferences.js';

export function preferencesRouter() {
  const router = Router();

  router.get('/', (_req, res) => res.json(getPreferences()));

  router.put('/', (req, res) => {
    try {
      const updated = updatePreferences(req.body || {});
      return res.json(updated);
    } catch (err) {
      if (err instanceof PreferencesError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  });

  return router;
}
