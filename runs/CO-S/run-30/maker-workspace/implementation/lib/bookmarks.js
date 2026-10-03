import { AppError } from './errors.js';
import { canonicalizeUrl } from './urls.js';

function normalizedLabel(label) {
  return String(label ?? '').trim().replace(/\s+/g, ' ');
}

export class BookmarkService {
  constructor({ store, metadataClient, clock = () => new Date() }) {
    this.store = store;
    this.metadataClient = metadataClient;
    this.clock = clock;
  }

  list() {
    return this.store.list().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  #require(id) {
    const bookmark = this.store.get(id);
    if (!bookmark) throw new AppError('NOT_FOUND', 'Bookmark not found.', 404);
    return bookmark;
  }

  async save({ url, label }) {
    const canonicalUrl = canonicalizeUrl(url);
    const existing = this.store.findByCanonicalUrl(canonicalUrl);
    if (existing) return { kind: 'duplicate', location: existing.archived ? 'archive' : 'library', bookmark: existing };

    const metadata = await this.metadataClient.retrieve(canonicalUrl);
    const now = this.clock().toISOString();
    const firstLabel = normalizedLabel(label);
    const bookmark = await this.store.insert({
      canonicalUrl,
      url: canonicalUrl,
      ...metadata,
      labels: firstLabel ? [firstLabel] : [],
      read: false,
      archived: false,
      createdAt: now,
      updatedAt: now
    });
    return { kind: 'created', bookmark };
  }

  async refresh(id) {
    const bookmark = this.#require(id);
    const metadata = await this.metadataClient.retrieve(bookmark.url);
    return this.store.update(id, { ...metadata, updatedAt: this.clock().toISOString() });
  }

  async addLabel(id, rawLabel) {
    const bookmark = this.#require(id);
    const label = normalizedLabel(rawLabel);
    if (!label) throw new AppError('EMPTY_LABEL', 'Enter a label.', 400);
    const duplicate = bookmark.labels.some((item) => item.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (duplicate) return { added: false, bookmark };
    const updated = await this.store.update(id, { labels: [...bookmark.labels, label], updatedAt: this.clock().toISOString() });
    return { added: true, bookmark: updated };
  }

  async setRead(id, read) {
    this.#require(id);
    return this.store.update(id, { read: Boolean(read), updatedAt: this.clock().toISOString() });
  }

  async archive(id) {
    this.#require(id);
    return this.store.update(id, { archived: true, updatedAt: this.clock().toISOString() });
  }

  async restore(id) {
    this.#require(id);
    return this.store.update(id, { archived: false, updatedAt: this.clock().toISOString() });
  }

  async restoreAndRefresh(id) {
    const bookmark = this.#require(id);
    const metadata = await this.metadataClient.retrieve(bookmark.url);
    return this.store.update(id, { ...metadata, archived: false, updatedAt: this.clock().toISOString() });
  }
}
