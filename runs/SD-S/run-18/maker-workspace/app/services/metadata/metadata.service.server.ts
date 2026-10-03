import type { AppDatabase } from "~/db/client.server";
import { createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { fallbackTitle, normalizeBookmarkUrl } from "~/features/bookmarks/url-normalization";
import { fetchPage, type FetchPageOptions } from "./fetch-page.server";
import { parsePageMetadata } from "./metadata-parser.server";
import { log } from "~/lib/logger.server";

export type MetadataWarning = "unreachable" | "blocked" | "timeout" | "non_html" | "missing_title";

function warningFrom(error: unknown): MetadataWarning {
  const message = error instanceof Error ? error.message : "unreachable";
  return (["blocked", "timeout", "non_html", "missing_title"] as const).includes(message as any)
    ? (message as MetadataWarning)
    : "unreachable";
}

export function createMetadataService(db: AppDatabase, fetchOptions: FetchPageOptions = {}) {
  const bookmarks = createBookmarkService(db);
  return {
    async preview(ownerId: string, inputUrl: string, requestId: string) {
      const url = normalizeBookmarkUrl(inputUrl);
      const duplicate = bookmarks.findDuplicate(ownerId, url);
      if (duplicate) {
        return { requestId, url, title: duplicate.title, description: null, status: "fallback" as const, warningCode: null, duplicate };
      }
      try {
        const fetched = await fetchPage(new URL(url), fetchOptions);
        const metadata = parsePageMetadata(fetched.body);
        if (!metadata.title) throw new Error("missing_title");
        return { requestId, url, title: metadata.title, description: metadata.description, status: "retrieved" as const, warningCode: null, duplicate: null };
      } catch (error) {
        const warningCode = warningFrom(error);
        log("warn", "metadata_preview_fallback", { ownerId, hostname: new URL(url).hostname, warningCode });
        return { requestId, url, title: fallbackTitle(url), description: null, status: "fallback" as const, warningCode, duplicate: null };
      }
    },
  };
}
