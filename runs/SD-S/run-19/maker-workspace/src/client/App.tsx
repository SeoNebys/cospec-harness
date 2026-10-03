import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bookmark, TagSummary } from '../shared/types.js';
import { listBookmarks, listTags } from './api/client.js';
import { BookmarkList } from './components/BookmarkList.js';
import { SaveBookmarkForm } from './components/SaveBookmarkForm.js';
import { SearchAndFilter } from './components/SearchAndFilter.js';

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const initialLoad = useRef(true);

  const refresh = useCallback(async (nextQuery = query, nextTag = selectedTag) => {
    try {
      const [result, tagResult] = await Promise.all([listBookmarks(nextQuery, nextTag), listTags()]);
      setBookmarks(result.items);
      setTags(tagResult.items);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The library could not be loaded.');
    } finally {
      setLoaded(true);
    }
  }, [query, selectedTag]);

  useEffect(() => {
    const delay = initialLoad.current ? 0 : 200;
    initialLoad.current = false;
    const timer = window.setTimeout(() => void refresh(query, selectedTag), delay);
    return () => window.clearTimeout(timer);
  }, [query, selectedTag, refresh]);

  const clearCriteria = () => {
    setQuery('');
    setSelectedTag('');
  };

  return (
    <div className="app-shell" {...(loaded ? { 'data-harness-ready': 'true' } : {})}>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Keepwell home"><span className="brand-mark">K</span><span>Keepwell</span></a>
        <p>Private by design <span aria-hidden="true">•</span> Yours alone</p>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">A considered collection</div>
          <h1>Keep the web<br /><em>worth keeping.</em></h1>
          <p>Save the articles, references, and small discoveries you want to find again—without turning your browser into a filing cabinet.</p>
        </section>
        <SaveBookmarkForm onSaved={() => refresh(query, selectedTag)} />
        <section className="library-section" aria-labelledby="library-heading">
          <div className="library-heading-row">
            <div>
              <div className="section-kicker">Your library</div>
              <h2 id="library-heading">Saved bookmarks</h2>
            </div>
            {loaded ? <span className="bookmark-count">{bookmarks.length} {bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}</span> : null}
          </div>
          {loaded ? <SearchAndFilter
            query={query}
            selectedTag={selectedTag}
            tags={tags}
            resultCount={bookmarks.length}
            onQueryChange={setQuery}
            onTagChange={setSelectedTag}
            onClear={clearCriteria}
          /> : null}
          {error ? <p className="message error-message" role="alert">{error}</p> : null}
          {!loaded ? <p className="loading-state" role="status">Opening your library…</p> : <BookmarkList bookmarks={bookmarks} hasCriteria={Boolean(query || selectedTag)} onClear={clearCriteria} onChanged={() => refresh(query, selectedTag)} />}
        </section>
      </main>
      <footer><span>Keepwell</span><span>Made for a quieter internet.</span></footer>
    </div>
  );
}
