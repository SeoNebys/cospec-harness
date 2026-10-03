import { Link, useRevalidator } from "react-router";
import type { Route } from "./+types/_library._index";
import { requirePageUser } from "~/auth/require-user.server";
import { BookmarkEditor } from "~/components/bookmark-editor";
import { BookmarkList } from "~/components/bookmark-list";
import { FilterBar } from "~/components/filter-bar";
import { SignOutButton } from "~/components/sign-out-button";
import { db } from "~/db/client.server";
import { createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { createTagRepository } from "~/features/bookmarks/tag.repository.server";
import { bookmarkListQuerySchema } from "~/features/bookmarks/bookmark.validation";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requirePageUser(request);
  const requestUrl = new URL(request.url);
  const parsed = bookmarkListQuerySchema.safeParse(Object.fromEntries(requestUrl.searchParams));
  const criteria = parsed.success ? parsed.data : { query: "", tag: "", cursor: undefined, limit: 50 };
  let bookmarks;
  try { bookmarks = createBookmarkService(db).list(user.id, criteria); }
  catch { bookmarks = createBookmarkService(db).list(user.id, { limit: 50 }); }
  const tags = createTagRepository(db).listWithCounts(user.id);
  return { user, bookmarks, tags, criteria };
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator();
  return (
    <div className="app-shell" data-harness-ready="true">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Keepsake home"><span className="brand-mark" aria-hidden="true">K</span><span>Keepsake</span></a>
        <div className="user-menu"><span>{loaderData.user.name}</span><SignOutButton /></div>
      </header>
      <main className="library-page">
        <section className="welcome">
          <div>
            <p className="eyebrow">Personal library</p>
            <h1>Good to see you, {loaderData.user.name.split(" ")[0]}.</h1>
            <p>Save what matters. We’ll keep it easy to find.</p>
          </div>
          <div className="library-count"><strong>{loaderData.bookmarks.items.length}</strong><span>saved<br />links</span></div>
        </section>
        <BookmarkEditor onSaved={() => revalidator.revalidate()} tagSuggestions={loaderData.tags.map((tag) => tag.name)} />
        <section className="library-section" aria-labelledby="library-heading">
          <div className="section-heading"><div><p className="eyebrow">Your collection</p><h2 id="library-heading">Recently saved</h2></div></div>
          <FilterBar key={`${loaderData.criteria.query}|${loaderData.criteria.tag}`} tags={loaderData.tags} />
          <BookmarkList bookmarks={loaderData.bookmarks.items} filtered={Boolean(loaderData.criteria.query || loaderData.criteria.tag)} tagSuggestions={loaderData.tags.map((tag) => tag.name)} onChanged={() => revalidator.revalidate()} />
          {loaderData.bookmarks.nextCursor ? <Link className="button button-secondary load-more" to={`?${new URLSearchParams({ ...(loaderData.criteria.query ? { query: loaderData.criteria.query } : {}), ...(loaderData.criteria.tag ? { tag: loaderData.criteria.tag } : {}), cursor: loaderData.bookmarks.nextCursor }).toString()}`}>Next page</Link> : null}
        </section>
      </main>
    </div>
  );
}
