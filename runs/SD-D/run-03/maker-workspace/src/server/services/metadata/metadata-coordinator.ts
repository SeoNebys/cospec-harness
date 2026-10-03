import pLimit from "p-limit";
import type { MetadataPreview, MetadataStatus } from "../../../shared/contracts/api.js";
import type { AppConfig } from "../../config.js";
import type { AppDatabase } from "../../db/database.js";
import { BookmarkRepository } from "../../repositories/bookmark-repository.js";
import { IconRepository } from "../../repositories/icon-repository.js";
import { fallbackTitleFromAddress } from "../bookmarks/address-normalizer.js";
import { extractPageMetadata, type ExtractedPageMetadata } from "./extract-metadata.js";
import {
  fetchHtml,
  fetchRasterImage,
  SafeMetadataFetchError,
  type SafeFetchResult,
} from "./safe-fetch.js";
import { processIconOrNull, type ProcessedIcon } from "./process-icon.js";

export interface MetadataFetchFunctions {
  html: (address: string) => Promise<SafeFetchResult>;
  icon: (address: string) => Promise<SafeFetchResult>;
}

export interface MetadataCoordinatorOptions {
  database: AppDatabase;
  config: AppConfig["metadata"];
  now?: () => Date;
  fetch?: Partial<MetadataFetchFunctions>;
}

interface RetrievedMetadata {
  extracted: ExtractedPageMetadata;
  icon: ProcessedIcon | null;
}

function errorCode(error: unknown): string {
  if (!(error instanceof SafeMetadataFetchError)) return "unavailable";
  const mapping: Record<string, string> = {
    TIMEOUT: "timeout",
    DENIED_DESTINATION: "denied_destination",
    UNSUPPORTED_PROTOCOL: "denied_destination",
    UNSUPPORTED_CONTENT_TYPE: "unsupported_content",
    TOO_LARGE: "too_large",
  };
  return mapping[error.code] ?? "unavailable";
}

function errorStatus(error: unknown): MetadataStatus {
  return error instanceof SafeMetadataFetchError &&
    (error.code === "DENIED_DESTINATION" || error.code === "UNSUPPORTED_PROTOCOL")
    ? "skipped_unsafe"
    : "failed";
}

export class MetadataCoordinator {
  private readonly bookmarks: BookmarkRepository;
  private readonly icons: IconRepository;
  private readonly now: () => Date;
  private readonly fetchers: MetadataFetchFunctions;
  private readonly limit: ReturnType<typeof pLimit>;
  private readonly scheduled = new Set<string>();
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly options: MetadataCoordinatorOptions) {
    this.bookmarks = new BookmarkRepository(options.database);
    this.icons = new IconRepository(options.database);
    this.now = options.now ?? (() => new Date());
    this.limit = pLimit(options.config.concurrency);
    this.fetchers = {
      html:
        options.fetch?.html ??
        ((address) =>
          fetchHtml(address, {
            deadlineMs: options.config.deadlineMs,
            connectTimeoutMs: options.config.connectTimeoutMs,
            maxBytes: options.config.maxHtmlBytes,
            maxRedirects: options.config.maxRedirects,
          })),
      icon:
        options.fetch?.icon ??
        ((address) =>
          fetchRasterImage(address, {
            deadlineMs: options.config.deadlineMs,
            connectTimeoutMs: options.config.connectTimeoutMs,
            maxBytes: options.config.maxIconBytes,
            maxRedirects: options.config.maxRedirects,
          })),
    };
  }

  start(): void {
    for (const item of this.bookmarks.pendingMetadata()) {
      this.enqueue(item.id, item.address, item.addressRevision);
    }
  }

  enqueue(bookmarkId: number, address: string, addressRevision: number): void {
    const key = `${bookmarkId}:${addressRevision}`;
    if (this.scheduled.has(key)) return;
    this.scheduled.add(key);
    const job = this.limit(() => this.enrich(bookmarkId, address, addressRevision))
      .catch(() => undefined)
      .finally(() => {
        this.scheduled.delete(key);
        this.pending.delete(job);
      });
    this.pending.add(job);
  }

  async drain(): Promise<void> {
    await Promise.all([...this.pending]);
  }

  async preview(address: string): Promise<MetadataPreview> {
    const fallbackTitle = fallbackTitleFromAddress(address);
    try {
      const result = await this.retrieve(address);
      const hasRetrievedText =
        result.extracted.titleSource !== "fallback" || result.extracted.description !== "";
      return {
        address,
        status: hasRetrievedText || result.icon ? "complete" : "partial",
        fallbackTitle,
        title: result.extracted.title,
        description: result.extracted.description,
        iconAvailable: result.icon !== null,
        errorCode: null,
      };
    } catch (error) {
      return {
        address,
        status: errorStatus(error),
        fallbackTitle,
        title: fallbackTitle,
        description: "",
        iconAvailable: false,
        errorCode: errorCode(error),
      };
    }
  }

  private async retrieve(address: string): Promise<RetrievedMetadata> {
    const page = await this.fetchers.html(address);
    const extracted = extractPageMetadata(page.body, page.finalUrl);
    let icon: ProcessedIcon | null = null;
    for (const candidate of extracted.iconCandidates) {
      try {
        const response = await this.fetchers.icon(candidate.url);
        icon = await processIconOrNull(response.body, {
          contentType: response.contentType,
          maxInputBytes: this.options.config.maxIconBytes,
        });
        if (icon) break;
      } catch {
        // An icon is optional. Try the next declared/fallback candidate.
      }
    }
    return { extracted, icon };
  }

  private async enrich(
    bookmarkId: number,
    address: string,
    addressRevision: number,
  ): Promise<void> {
    try {
      const result = await this.retrieve(address);
      const fetchedAt = this.now().toISOString();
      if (result.icon) this.icons.put({ ...result.icon, createdAt: fetchedAt });
      const hasTitle = result.extracted.titleSource !== "fallback";
      const hasDescription = result.extracted.description !== "";
      const hasIcon = result.icon !== null;
      this.bookmarks.applyMetadata({
        bookmarkId,
        addressRevision,
        ...(hasTitle ? { title: result.extracted.title } : {}),
        ...(hasDescription ? { description: result.extracted.description } : {}),
        ...(result.icon ? { iconHash: result.icon.contentHash } : {}),
        status:
          hasTitle && hasDescription
            ? "complete"
            : hasTitle || hasDescription || hasIcon
              ? "partial"
              : "failed",
        errorCode: hasTitle || hasDescription || hasIcon ? null : "metadata_missing",
        fetchedAt,
      });
    } catch (error) {
      this.bookmarks.applyMetadata({
        bookmarkId,
        addressRevision,
        status: errorStatus(error),
        errorCode: errorCode(error),
        fetchedAt: this.now().toISOString(),
      });
    }
  }
}
