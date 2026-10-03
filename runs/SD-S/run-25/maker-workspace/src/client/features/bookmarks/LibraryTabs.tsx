import { useRef, type KeyboardEvent } from 'react';

import type { BookmarkListView } from '../../../shared/contracts.js';

export interface LibraryTabsProps {
  view: BookmarkListView;
  onChange: (view: BookmarkListView) => void;
}

const tabs: ReadonlyArray<{ view: BookmarkListView; label: string; id: string }> = [
  { view: 'all', label: 'Library', id: 'library-tab' },
  { view: 'read-later', label: 'Read Later', id: 'read-later-tab' },
];

export function LibraryTabs({ view, onChange }: LibraryTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.view);
    refs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(tabs.length - 1);
    else select((index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length);
  };

  return (
    <div role="tablist" aria-label="Bookmark views">
      {tabs.map((tab, index) => {
        const selected = tab.view === view;
        return (
          <button
            key={tab.view}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${tab.id}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.view)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
