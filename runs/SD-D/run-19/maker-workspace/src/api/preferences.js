import { Router } from 'express';
import { getPreferences, updatePreferences, ValidationError } from '../models/preferences.js';

const router = Router();

router.get('/', (req, res) => res.json(getPreferences()));

router.put('/', (req, res, next) => {
  try {
    res.json(updatePreferences(req.body));
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: { code: 'invalid', message: err.message } });
    next(err);
  }
});

export default router;
