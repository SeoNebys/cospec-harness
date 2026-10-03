import { useEffect, useId, useState } from 'react';
import { api } from '../../lib/api';

export function TagAutocomplete({
  labels,
  onChange,
  excludeBookmarkId,
}: {
  labels: string[];
  onChange: (labels: string[]) => void;
  excludeBookmarkId?: string;
}) {
  const [input, setInput] = useState('');
  const [items, setItems] = useState<Array<{ id: string; label: string }>>([]);
  const [active, setActive] = useState(0);
  const listId = useId();
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        void api<{ items: Array<{ id: string; label: string }> }>(
          `/api/tags?suggest=${encodeURIComponent(input)}${excludeBookmarkId ? `&excludeBookmarkId=${excludeBookmarkId}` : ''}`,
        )
          .then((result) =>
            setItems(
              result.items.filter(
                (item) =>
                  !labels.some((label) => label.toLocaleLowerCase() === item.label.toLocaleLowerCase()),
              ),
            ),
          )
          .catch(() => setItems([])),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [input, labels, excludeBookmarkId]);
  const add = (label: string) => {
    const clean = label.trim().replace(/\s+/g, ' ');
    if (
      !clean ||
      clean.length > 30 ||
      labels.some((item) => item.toLocaleLowerCase() === clean.toLocaleLowerCase()) ||
      labels.length >= 20
    )
      return;
    onChange([...labels, clean]);
    setInput('');
    setItems([]);
  };
  return (
    <div>
      <div className="tag-list">
        {labels.map((label) => (
          <span className="tag-pill" key={label}>
            #{label}
            <button
              type="button"
              aria-label={`Remove tag ${label}`}
              onClick={() => onChange(labels.filter((item) => item !== label))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-wrap">
        <input
          id="tags"
          value={input}
          maxLength={30}
          role="combobox"
          aria-label="Add tags"
          aria-autocomplete="list"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
          placeholder="Type to reuse or create a tag"
          onChange={(event) => {
            setInput(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && items.length) {
              event.preventDefault();
              setActive((value) => (value + 1) % items.length);
            }
            if (event.key === 'ArrowUp' && items.length) {
              event.preventDefault();
              setActive((value) => (value - 1 + items.length) % items.length);
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              add(items[active]?.label ?? input);
            }
          }}
        />
        {items.length > 0 && (
          <div className="suggestions" id={listId} role="listbox">
            {items.map((item, index) => (
              <button
                type="button"
                role="option"
                id={`${listId}-${index}`}
                aria-selected={index === active}
                key={item.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(item.label)}
              >
                {item.label}
                <small>
                  {item.label.toLocaleLowerCase().startsWith(input.toLocaleLowerCase())
                    ? ' — starts with'
                    : ' — contains'}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
