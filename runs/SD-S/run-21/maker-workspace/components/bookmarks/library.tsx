"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Bookmark, Scope, Tag } from "@/lib/bookmarks/types";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { BookmarkCard } from "./bookmark-card";
import { BookmarkForm } from "./bookmark-form";
import { BookmarkFilters } from "@/components/filters/bookmark-filters";
const copy: { [K in Scope]: [string, string] } = {
  active: ["Your library", "Everything you’ve kept, all in one place."],
  to_read: ["To read", "A thoughtful queue for your next quiet moment."],
  favorites: ["Favorites", "The links you never want to lose track of."],
  archived: ["Archive", "Out of sight, never out of reach."]
};
export function Library({ scope }: { scope: Scope }) {
  const search = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Bookmark | null | "new">(
    search.get("add") ? "new" : null
  );
  const [q, setQ] = useState(search.get("q") || "");
  const [tag, setTag] = useState(search.get("tag") || "");
  const [reading, setReading] = useState(search.get("readingStatus") || "");
  const [sort, setSort] = useState(search.get("sort") || "created_desc");
  const [page, setPage] = useState(Number(search.get("page") || 1));
  const load = useCallback(async () => {
    setBusy(true);
    const p = new URLSearchParams({ scope, sort, page: String(page) });
    if (q) p.set("q", q);
    if (tag) p.set("tag", tag);
    if (reading) p.set("readingStatus", reading);
    const [a, b] = await Promise.all([
      fetch(`/api/bookmarks?${p}`, { cache: "no-store" }),
      fetch("/api/tags", { cache: "no-store" })
    ]);
    if (a.ok) {
      const d = await a.json();
      setItems(d.items);
      setTotal(d.total);
    }
    if (b.ok) setTags(await b.json());
    setReady(true);
    setBusy(false);
  }, [scope, q, tag, reading, sort, page]);
  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tag) p.set("tag", tag);
    if (reading) p.set("readingStatus", reading);
    if (sort !== "created_desc") p.set("sort", sort);
    if (page > 1) p.set("page", String(page));
    const next = p.toString();
    if (next !== search.toString())
      router.replace(`${location.pathname}${next ? `?${next}` : ""}`, {
        scroll: false
      });
  }, [q, tag, reading, sort, page, router, search]);
  async function mutate(item: Bookmark, kind: string) {
    if (
      kind === "delete" &&
      !confirm(`Permanently delete “${item.title}”? This cannot be undone.`)
    )
      return;
    let url = `/api/bookmarks/${item.id}`,
      method = "PATCH",
      body: unknown = undefined;
    if (kind === "favorite") body = { favorite: !item.favorite };
    if (kind === "reading")
      body = {
        readingStatus: item.readingStatus === "to_read" ? "read" : "to_read"
      };
    if (kind === "archive" || kind === "restore") {
      url += `/${kind}`;
      method = "POST";
    }
    if (kind === "delete") method = "DELETE";
    const r = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (r.ok) {
      setNotice(
        kind === "delete"
          ? "Bookmark permanently deleted."
          : kind === "archive"
            ? "Bookmark moved to the archive."
            : kind === "restore"
              ? "Bookmark restored to your library."
              : "Bookmark updated."
      );
      load();
    } else setNotice("That change couldn't be completed.");
  }
  const [title, subtitle] = copy[scope];
  return (
    <AppShell ready={ready}>
      <main>
        <header className="page-header">
          <div>
            <span className="eyebrow">
              {scope === "active"
                ? "THE GOOD STUFF"
                : scope.replace("_", " ").toUpperCase()}
            </span>
            <h1>
              {title}
              <span className="count">{total}</span>
            </h1>
            <p>{subtitle}</p>
          </div>
          <button className="primary add" onClick={() => setForm("new")}>
            <span>＋</span> Add bookmark
          </button>
        </header>
        <BookmarkFilters
          q={q}
          setQ={(v) => {
            setQ(v);
            setPage(1);
          }}
          tag={tag}
          setTag={(v) => {
            setTag(v);
            setPage(1);
          }}
          reading={reading}
          setReading={(v) => {
            setReading(v);
            setPage(1);
          }}
          sort={sort}
          setSort={(v) => {
            setSort(v);
            setPage(1);
          }}
          tags={tags}
        />
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        <div className={busy ? "grid loading" : "grid"}>
          {items.map((item) => (
            <BookmarkCard
              key={item.id}
              item={item}
              onEdit={() => setForm(item)}
              onMutate={(kind) => mutate(item, kind)}
            />
          ))}
        </div>
        {ready && !items.length && (
          <EmptyState
            archive={scope === "archived"}
            filtered={Boolean(q || tag || reading)}
          />
        )}{" "}
        {total > 24 && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((v) => v - 1)}>
              ← Previous
            </button>
            <span>
              Page {page} of {Math.ceil(total / 24)}
            </span>
            <button
              disabled={page * 24 >= total}
              onClick={() => setPage((v) => v + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </main>
      {form && (
        <BookmarkForm
          bookmark={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setNotice("Bookmark saved to your shelf.");
            load();
          }}
        />
      )}
    </AppShell>
  );
}
