export function ReadingStateButton({
  state,
  onChange,
}: {
  state: 'none' | 'unread' | 'read';
  onChange(value: 'unread' | 'read'): void;
}) {
  return (
    <button
      type="button"
      className={`state-button ${state === 'unread' ? 'state-button--active' : ''}`}
      onClick={() => onChange(state === 'unread' ? 'read' : 'unread')}
    >
      {state === 'unread' ? '✓ Mark read' : '◷ Read later'}
    </button>
  );
}
