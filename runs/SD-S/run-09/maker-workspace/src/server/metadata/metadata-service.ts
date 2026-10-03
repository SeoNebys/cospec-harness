import type { MetadataPreview } from "../../shared/contracts/bookmarks.js";
import type { AppConfig } from "../config.js";
import { IconRepository } from "../repositories/icon-repository.js";
import type { BookmarkRepository } from "../repositories/bookmark-repository.js";
import { parseMetadata } from "./parse-metadata.js";
import { signReceipt, type ReceiptPayload } from "./receipt.js";
import { SafeHttpClient, MetadataFetchError } from "./safe-http-client.js";
import { parseBookmarkUrl } from "./url-policy.js";
import { validateIcon } from "./validate-icon.js";
import { AppError } from "../api/errors.js";

type Captured = Omit<ReceiptPayload, "userId" | "normalizedUrl" | "expiresAt"> & { iconDataUrl: string | null };

export class MetadataService {
  private readonly recent = new Map<string, number[]>();
  constructor(
    private readonly client: SafeHttpClient,
    private readonly icons: IconRepository,
    private readonly config: AppConfig
  ) {}

  async preview(userId: string, input: string): Promise<MetadataPreview> {
    this.reserveAttempt(userId);
    const parsed = parseBookmarkUrl(input);
    const captured = await this.capture(parsed.networkUrl, parsed.fallbackTitle, parsed.metadataEligible);
    const receipt = signReceipt({
      userId, normalizedUrl: parsed.normalizedUrl, title: captured.title, titleSource: captured.titleSource,
      status: captured.status, failureCode: captured.failureCode, iconAssetId: captured.iconAssetId,
      finalUrl: captured.finalUrl, expiresAt: Date.now() + 10 * 60_000
    }, this.config.authSecret);
    return {
      title: captured.title, titleSource: captured.titleSource, iconDataUrl: captured.iconDataUrl,
      status: captured.status, failureCode: captured.failureCode, receipt
    };
  }

  async enrichBookmark(repository: BookmarkRepository, userId: string, id: number, input: string): Promise<void> {
    try {
      const parsed = parseBookmarkUrl(input);
      const captured = await this.capture(parsed.networkUrl, parsed.fallbackTitle, parsed.metadataEligible);
      repository.applyMetadata(userId, id, captured);
    } catch {
      repository.applyMetadata(userId, id, {
        title: parseBookmarkUrl(input).fallbackTitle, titleSource: "fallback", iconAssetId: null,
        status: "failed", failureCode: "unavailable", finalUrl: null
      });
    }
  }

  reserveAttempt(userId: string): void {
    const cutoff = Date.now() - 60_000;
    const hits = (this.recent.get(userId) ?? []).filter((time) => time > cutoff);
    if (hits.length >= 12) throw new AppError(429, "RATE_LIMITED", "Too many metadata requests. Try again shortly.");
    hits.push(Date.now()); this.recent.set(userId, hits);
  }

  private async capture(url: URL, fallbackTitle: string, eligible: boolean): Promise<Captured> {
    if (!eligible) return this.fallback(fallbackTitle, "blocked");
    try {
      const page = await this.client.fetchHtml(url);
      const parsed = parseMetadata(page.body, page.finalUrl);
      let iconAssetId: number | null = null;
      let iconDataUrl: string | null = null;
      if (parsed.iconUrl) {
        try {
          const response = await this.client.fetchIcon(parsed.iconUrl);
          const icon = validateIcon(response.body);
          if (icon) {
            iconAssetId = this.icons.save(icon);
            iconDataUrl = `data:${icon.mediaType};base64,${icon.bytes.toString("base64")}`;
          }
        } catch { /* generic icon is intentional */ }
      }
      const title = parsed.title ?? fallbackTitle;
      return {
        title, titleSource: parsed.title ? "page" : "fallback", iconAssetId, iconDataUrl,
        status: parsed.title && iconAssetId ? "ready" : "partial", failureCode: parsed.title ? null : "title_unavailable",
        finalUrl: page.finalUrl
      };
    } catch (error) {
      const code = error instanceof MetadataFetchError ? error.code : "network";
      return this.fallback(fallbackTitle, code === "blocked" ? "blocked" : "unavailable");
    }
  }

  private fallback(title: string, code: string): Captured {
    return { title, titleSource: "fallback", iconAssetId: null, iconDataUrl: null,
      status: code === "blocked" ? "blocked" : "failed", failureCode: code, finalUrl: null };
  }
}
