import express from 'express';
import { getPreferences, updatePreferences } from '../models/preferences.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ preferences: getPreferences() });
});

router.patch('/', (req, res) => {
  res.json({ preferences: updatePreferences(req.body) });
});

export default router;
