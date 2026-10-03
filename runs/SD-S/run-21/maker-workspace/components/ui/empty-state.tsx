export function EmptyState({
  filtered,
  archive
}: {
  filtered: boolean;
  archive: boolean;
}) {
  return (
    <div className="empty">
      <div className="empty-glyph">{archive ? "□" : "⌁"}</div>
      <h2>
        {filtered
          ? "Nothing matches just yet"
          : archive
            ? "Your archive is empty"
            : "Start a shelf worth returning to"}
      </h2>
      <p>
        {filtered
          ? "Try a broader search or clear a filter."
          : archive
            ? "Bookmarks you tuck away will wait here."
            : "Save an article, a recipe, or anything that caught your eye."}
      </p>
    </div>
  );
}
