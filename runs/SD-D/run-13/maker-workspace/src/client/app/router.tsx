import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell.js';
import { CollectionPage } from '../features/bookmarks/CollectionPage.js';
import { NewBookmarkPage } from '../features/bookmarks/NewBookmarkPage.js';
import { BookmarkDetailPage } from '../features/bookmarks/BookmarkDetailPage.js';
import { EditBookmarkPage } from '../features/bookmarks/EditBookmarkPage.js';

export const router = createBrowserRouter([{ path: '/', element: <AppShell />, children: [
  { index: true, element: <CollectionPage view="active" /> },
  { path: 'to-read', element: <CollectionPage view="to-read" /> },
  { path: 'archive', element: <CollectionPage view="archive" /> },
  { path: 'bookmarks/new', element: <NewBookmarkPage /> },
  { path: 'bookmarks/:id', element: <BookmarkDetailPage /> },
  { path: 'bookmarks/:id/edit', element: <EditBookmarkPage /> },
]}]);
