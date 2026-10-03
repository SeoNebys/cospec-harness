import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { SessionProvider, useSession } from '../features/auth/session.js';
import { AppShell } from './AppShell.js';
import { LoginPage } from '../routes/LoginPage.js';
import { LibraryPage } from '../routes/LibraryPage.js';
import { BookmarkDetailPage } from '../routes/BookmarkDetailPage.js';
import { ImportExportPage } from '../routes/ImportExportPage.js';
function Gate() {
  const session = useSession();
  if (session.loading) return <main className="center-status">Opening your private library…</main>;
  return session.authenticated ? (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LibraryPage />} />
        <Route path="bookmarks/:id" element={<BookmarkDetailPage />} />
        <Route path="import-export" element={<ImportExportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  ) : (
    <LoginPage />
  );
}
export function AppRouter() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </BrowserRouter>
  );
}
