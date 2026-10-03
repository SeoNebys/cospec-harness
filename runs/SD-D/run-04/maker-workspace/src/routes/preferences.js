import express from 'express';
import { getPreferences, updatePreferences } from '../models/preferences.js';

const router = express.Router();

// GET /api/preferences (FR-039)
router.get('/', (req, res) => {
  res.json(getPreferences());
});

// PUT /api/preferences (FR-039)
router.put('/', (req, res) => {
  try {
    res.json(updatePreferences(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: { code: 'invalid_preference', message: err.message } });
  }
});

export default router;
