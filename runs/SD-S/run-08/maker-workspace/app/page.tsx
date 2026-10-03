"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookmarkForm } from "../components/bookmark-form";
import { BookmarkList } from "../components/bookmark-list";
import { Filters, type FilterState, type TagCount } from "../components/filters";
import { jsonRequest, type Bookmark } from "../components/types";

function HomeContent() {
  const router = useRouter(); const params = useSearchParams();
  const initial: FilterState = { q: params.get("q") || "", tag: params.get("tag") || "", sort: (params.get("sort") as FilterState["sort"]) || "newest" };
  const [filters, setFilters] = useState(initial); const [items, setItems] = useState<Bookmark[]>([]); const [tags, setTags] = useState<TagCount[]>([]); const [nextCursor, setNextCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const requestNumber = useRef(0);
  const load = useCallback(async (cursor?: string) => { const current = ++requestNumber.current; setLoading(true); setError(""); try { const query = new URLSearchParams(); if (filters.q) query.set("q", filters.q); if (filters.tag) query.set("tag", filters.tag); query.set("sort", filters.sort); if (cursor) query.set("cursor", cursor); const data = await jsonRequest<{ items: Bookmark[]; nextCursor?: string | null }>(`/api/bookmarks?${query}`); if (current !== requestNumber.current) return; setItems((old) => cursor ? [...old, ...data.items] : data.items); setNextCursor(data.nextCursor ?? null); } catch (e) { if (current === requestNumber.current) setError(e instanceof Error ? e.message : "Could not load bookmarks."); } finally { if (current === requestNumber.current) setLoading(false); } }, [filters]);
  const refreshTags = useCallback(() => jsonRequest<{ items: TagCount[] }>("/api/tags").then((data) => setTags(data.items)).catch(() => setTags([])), []);
  // Network callbacks perform the state updates; this effect starts synchronization.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); refreshTags(); }, [load, refreshTags]);
  function changeFilters(next: FilterState) { setFilters(next); const query = new URLSearchParams(); if (next.q) query.set("q", next.q); if (next.tag) query.set("tag", next.tag); if (next.sort !== "newest") query.set("sort", next.sort); router.replace(query.size ? `/?${query}` : "/", { scroll: false }); }
  function refresh() { load(); refreshTags(); }
  return <div className="page-shell" data-harness-ready={!loading && !error ? "true" : undefined}>
    <section className="hero"><div><span className="eyebrow">A quieter corner of the internet</span><h1>Keep the links<br /><em>that matter.</em></h1><p>Save ideas, references, and discoveries in one thoughtful place.</p></div><BookmarkForm onSaved={refresh} /></section>
    <section className="library" aria-labelledby="library-title"><div className="section-heading"><div><span className="eyebrow">Your collection</span><h2 id="library-title">Saved bookmarks</h2></div>{items.length > 0 && <span className="count">{items.length}{nextCursor ? "+" : ""} saved</span>}</div><Filters value={filters} tags={tags} onChange={changeFilters} />{error && <div className="notice error" role="alert">{error} <button className="text-button" onClick={() => load()}>Try again</button></div>}<BookmarkList items={items} loading={loading} filtered={Boolean(filters.q || filters.tag)} nextCursor={nextCursor} onMore={() => nextCursor && load(nextCursor)} onDeleted={() => refresh()} onTag={(tag) => changeFilters({ ...filters, tag })} /></section>
  </div>;
}

export default function HomePage() {
  return <Suspense fallback={<div className="loading-block" role="status">Loading your bookmarks…</div>}><HomeContent /></Suspense>;
}
