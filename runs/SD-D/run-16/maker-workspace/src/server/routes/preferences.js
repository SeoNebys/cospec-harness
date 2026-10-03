import express from 'express';
import { getPreferences, updatePreferences } from '../services/preferences.js';

export const preferencesRouter = express.Router();

preferencesRouter.get('/', (req, res) => {
  res.json(getPreferences());
});

preferencesRouter.put('/', (req, res) => {
  res.json(updatePreferences(req.body || {}));
});
