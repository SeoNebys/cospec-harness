import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { AppShell } from './AppShell';
import { useLibraryState } from './useLibraryState';
import { LibraryPage } from '../features/bookmarks/LibraryPage';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }
  render() {
    return this.state.failed ? (
      <main className="app-shell">
        <div className="empty" data-harness-ready="true">
          <h1>Pinboard needs a refresh</h1>
          <p>An unexpected error interrupted this view. Your saved bookmarks are still safe.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}

function BookmarkApp() {
  const library = useLibraryState();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');
  return (
    <AppShell
      view={library.params.view}
      counts={library.counts}
      onView={(view) => library.update({ view })}
      onCreate={() => setCreating(true)}
      status={status}
    >
      <LibraryPage library={library} creating={creating} setCreating={setCreating} announce={setStatus} />
    </AppShell>
  );
}
export function App() {
  return (
    <ErrorBoundary>
      <BookmarkApp />
    </ErrorBoundary>
  );
}
