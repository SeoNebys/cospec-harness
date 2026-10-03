import { createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { CollectionPage } from '../features/collection/CollectionPage';
import { ReadLaterPage } from '../features/collection/ReadLaterPage';
import { ArchivePage } from '../features/collection/ArchivePage';
import { DataPortabilityPage } from '../features/settings/DataPortabilityPage';

export const router = createBrowserRouter([{
  path: '/', element: <App />, errorElement: <main className="center-message" role="alert">That page could not be loaded.</main>, children: [
    { index: true, element: <CollectionPage /> },
    { path: 'read-later', element: <ReadLaterPage /> },
    { path: 'archive', element: <ArchivePage /> },
    { path: 'settings', element: <DataPortabilityPage /> },
  ],
}]);
