"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookmarkForm } from "../../../../components/bookmark-form";
import { jsonRequest, type Bookmark } from "../../../../components/types";

export default function EditBookmarkPage() {
  const { id } = useParams<{ id: string }>(); const [bookmark, setBookmark] = useState<Bookmark | null>(null); const [error, setError] = useState("");
  useEffect(() => { jsonRequest<Bookmark>(`/api/bookmarks/${id}`).then(setBookmark).catch((e) => setError(e instanceof Error ? e.message : "Bookmark not found.")); }, [id]);
  return <div className="narrow-page" data-harness-ready={bookmark || error ? "true" : undefined}><Link className="back-link" href="/">← Back to bookmarks</Link><span className="eyebrow">Edit bookmark</span><h1>Refine what you saved.</h1>{error ? <div className="notice error" role="alert">{error}</div> : bookmark ? <BookmarkForm bookmark={bookmark} /> : <p role="status">Loading bookmark…</p>}</div>;
}
