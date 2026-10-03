/* eslint-disable @next/next/no-img-element */
"use client";
import type { Bookmark } from "@/lib/bookmarks/types";
export function BookmarkCard({
  item,
  onEdit,
  onMutate
}: {
  item: Bookmark;
  onEdit: () => void;
  onMutate: (kind: string) => void;
}) {
  let host = "";
  try {
    host = new URL(item.url).hostname.replace(/^www\./, "");
  } catch {}
  return (
    <article className="card">
      <a
        className="card-image"
        href={item.url}
        target="_blank"
        rel="noreferrer"
        style={
          item.previewImageUrl
            ? {
                backgroundImage: `url("${item.previewImageUrl.replaceAll('"', "")}")`
              }
            : undefined
        }
      >
        {!item.previewImageUrl && (
          <span>{host.slice(0, 1).toUpperCase() || "K"}</span>
        )}
        <span className="open-label">Open ↗</span>
      </a>
      <div className="card-body">
        <div className="source">
          {item.siteIconUrl ? (
            <img src={item.siteIconUrl} alt="" />
          ) : (
            <span className="tiny-icon" />
          )}
          <span>{host}</span>
          <button
            className={item.favorite ? "star selected" : "star"}
            aria-label={item.favorite ? "Remove favorite" : "Add favorite"}
            onClick={() => onMutate("favorite")}
          >
            ★
          </button>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="card-title"
        >
          {item.title}
        </a>
        {item.description && <p className="description">{item.description}</p>}
        <div className="tags">
          {item.tags.map((t) => (
            <span key={t.id}>#{t.name}</span>
          ))}
        </div>
        <div className="card-footer">
          <button
            className={
              item.readingStatus === "to_read" ? "status to-read" : "status"
            }
            onClick={() => onMutate("reading")}
          >
            {item.readingStatus === "to_read" ? "◷  To read" : "✓  Read"}
          </button>
          <div className="actions">
            <button onClick={onEdit}>Edit</button>
            <button
              onClick={() => onMutate(item.archived ? "restore" : "archive")}
            >
              {item.archived ? "Restore" : "Archive"}
            </button>
            <button className="danger" onClick={() => onMutate("delete")}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
