import { fallbackTitle, parseDocumentMetadata } from "./html";
import { fetchHtml, type MetadataFetcherOptions } from "./fetcher";
import { retrieveIcon } from "./icons";

export type TitleOrigin = "fetched" | "fallback" | "user";
export interface MetadataPreview { normalizedUrl: string; title: string; titleOrigin: "fetched" | "fallback"; iconToken: string | null; warning: string | null; existingBookmarkId: string | null }
export interface PreviewDependencies {
  normalizeUrl: (url: string) => string | { url?: string; normalizedUrl?: string };
  findExistingId?: (normalizedUrl: string) => Promise<string | null>;
  fetchOptions?: MetadataFetcherOptions;
  fetchPage?: typeof fetchHtml;
  fetchIcon?: typeof retrieveIcon;
}

export function titleOriginAfterEdit(previous: TitleOrigin, oldTitle: string, newTitle: string): TitleOrigin {
  return oldTitle.trim() === newTitle.trim() ? previous : "user";
}

export async function createMetadataPreview(input: string, dependencies: PreviewDependencies): Promise<MetadataPreview> {
  const normalized = dependencies.normalizeUrl(input);
  const normalizedUrl = typeof normalized === "string" ? normalized : normalized.normalizedUrl ?? normalized.url;
  if (!normalizedUrl) throw new Error("URL normalization returned no URL");
  const existingBookmarkId = await dependencies.findExistingId?.(normalizedUrl) ?? null;
  try {
    const page = await (dependencies.fetchPage ?? fetchHtml)(normalizedUrl, dependencies.fetchOptions);
    const metadata = parseDocumentMetadata(page.body.toString("utf8"), page.finalUrl);
    if (!metadata.title) throw new Error("missing title");
    let iconToken: string | null = null;
    for (const candidate of metadata.iconCandidates) {
      iconToken = await (dependencies.fetchIcon ?? retrieveIcon)(candidate.url, dependencies.fetchOptions);
      if (iconToken) break;
    }
    return { normalizedUrl, title: metadata.title, titleOrigin: "fetched", iconToken, warning: null, existingBookmarkId };
  } catch {
    return { normalizedUrl, title: fallbackTitle(normalizedUrl), titleOrigin: "fallback", iconToken: null, warning: "We could not retrieve this page’s details. You can edit the title and save it anyway.", existingBookmarkId };
  }
}
