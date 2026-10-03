import express from 'express';
import bookmarks from './bookmarks.js';
import tags from './tags.js';
import views from './views.js';
import preferences from './preferences.js';
import importExport from './importExport.js';

const router = express.Router();

router.use('/bookmarks', bookmarks);
router.use('/tags', tags);
router.use('/views', views);
router.use('/preferences', preferences);
router.use('/', importExport); // /import and /export

export default router;
