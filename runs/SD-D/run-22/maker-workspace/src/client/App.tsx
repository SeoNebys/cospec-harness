import { Component, type ErrorInfo, type ReactNode, useState } from 'react';
import './styles/global.css';
import './styles/library.css';
import { BookmarksView } from './features/bookmarks/BookmarksView';

type View = 'library' | 'read-later';

interface ErrorBoundaryState {
  failed: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, details: ErrorInfo): void {
    console.error('The application view failed', error, details.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="shell shell--message">
          <h1>Bookmarks</h1>
          <p role="alert">The library could not be displayed. Reload the page to try again.</p>
        </main>
      );
    }
    return this.props.children;
  }
}

function ApplicationShell() {
  const [view, setView] = useState<View>('library');
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  return (
    <div className="app" data-harness-ready="true">
      <header className="masthead">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            setView('library');
          }}
        >
          Keepsake
        </a>
        <nav aria-label="Primary navigation">
          <button
            aria-current={view === 'library' ? 'page' : undefined}
            onClick={() => setView('library')}
          >
            Library
          </button>
          <button
            aria-current={view === 'read-later' ? 'page' : undefined}
            onClick={() => setView('read-later')}
          >
            Read later{' '}
            {unreadCount > 0 && (
              <span className="nav-count" aria-label={`${unreadCount} unread`}>
                {unreadCount}
              </span>
            )}
          </button>
        </nav>
      </header>
      <main className="shell" id="main-content">
        <p className="eyebrow">Personal bookmark manager</p>
        <h1>{view === 'library' ? 'Your library' : 'Read later'}</h1>
        <p className="lede">
          {view === 'library'
            ? 'Save the useful corners of the web and find them again.'
            : 'A quiet queue for the things you want to return to.'}
        </p>
        <BookmarksView
          scope={view === 'library' ? 'all' : 'unread-read-later'}
          onUnreadCountChange={setUnreadCount}
          announce={setAnnouncement}
        />
      </main>
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
        id="operation-status"
      >
        {announcement}
      </div>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <ApplicationShell />
    </ErrorBoundary>
  );
}
