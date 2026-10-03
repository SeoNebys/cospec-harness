export function FavoriteButton({
  active,
  onClick,
  label = true,
}: {
  active: boolean;
  onClick(): void;
  label?: boolean;
}) {
  return (
    <button
      type="button"
      className={`state-button ${active ? 'state-button--active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {active ? '◆' : '◇'} {label && (active ? 'Favorite' : 'Add favorite')}
    </button>
  );
}
