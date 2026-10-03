import express from 'express';
import { getPreferences, updatePreferences } from '../models/preferences.js';

export function preferencesRouter(db) {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ preferences: getPreferences(db) }));
  router.patch('/', (req, res) => {
    try {
      const prefs = updatePreferences(db, req.body || {});
      res.json({ preferences: prefs });
    } catch (err) {
      if (err.code === 'validation') {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
  return router;
}
