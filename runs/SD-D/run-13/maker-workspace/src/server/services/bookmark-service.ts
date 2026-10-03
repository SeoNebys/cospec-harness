import type { BookmarkDatabase } from '../db/connection.js';
import { BookmarkRepository, type BookmarkWrite } from '../db/repositories/bookmark-repository.js';
import { MediaRepository } from '../db/repositories/media-repository.js';
import { MetadataDraftRepository } from '../db/repositories/metadata-draft-repository.js';
import { TagRepository } from '../db/repositories/tag-repository.js';
import type { Bookmark, RichTextDocument } from '../../shared/api/types.js';
import { AppError, ValidationError } from '../../shared/api/errors.js';
import { LIMITS } from '../../shared/config/limits.js';
import { EMPTY_NOTE, validateNote } from '../../shared/notes/schema.js';
import { noteToPlainText } from '../../shared/notes/to-plain-text.js';
import { validateTags } from '../../shared/tags/normalize-tag.js';
import { normalizeUrl } from '../../shared/urls/normalize-url.js';

export interface BookmarkInput { url?: unknown; title?: unknown; description?: unknown; notes?: unknown; tags?: unknown; favorite?: unknown; toRead?: unknown; metadataDraftId?: unknown }

export class BookmarkService {
  private bookmarks: BookmarkRepository; private drafts: MetadataDraftRepository; private tags: TagRepository; private media: MediaRepository;
  constructor(private readonly db: BookmarkDatabase) { this.bookmarks = new BookmarkRepository(db); this.drafts = new MetadataDraftRepository(db); this.tags = new TagRepository(db); this.media = new MediaRepository(db); }

  get(id: string): Bookmark { const item = this.bookmarks.get(id); if (!item) throw new AppError(404,'NOT_FOUND','Bookmark not found.'); return item; }

  private validated(input: BookmarkInput, existing?: Bookmark): BookmarkWrite {
    const fieldErrors: Record<string,string[]> = {};
    const url = String(input.url ?? existing?.url ?? '').trim(); let normalizedUrl = '';
    try { normalizedUrl = normalizeUrl(url); } catch (error) { fieldErrors.url = [(error as Error).message]; }
    const title = typeof (input.title ?? existing?.title) === 'string' ? String(input.title ?? existing?.title).trim() : '';
    if (!title || [...title].length > LIMITS.titleLength) fieldErrors.title = [`Title must be 1–${LIMITS.titleLength} characters.`];
    const descriptionValue = input.description !== undefined ? input.description : existing?.description;
    const description = descriptionValue === null || descriptionValue === undefined || descriptionValue === '' ? null : String(descriptionValue);
    if (description && [...description].length > LIMITS.descriptionLength) fieldErrors.description = [`Description must be at most ${LIMITS.descriptionLength} characters.`];
    let notes: RichTextDocument = existing?.notes ?? EMPTY_NOTE;
    try { notes = validateNote(input.notes ?? notes); } catch (error) { fieldErrors.notes = [(error as Error).message]; }
    let tags = existing?.tags.map((tag) => tag.name) ?? [];
    try { tags = validateTags(input.tags ?? tags); } catch (error) { fieldErrors.tags = [(error as Error).message]; }
    const favorite = input.favorite === undefined ? existing?.favorite ?? false : input.favorite;
    const toRead = input.toRead === undefined ? existing?.toRead ?? false : input.toRead;
    if (typeof favorite !== 'boolean') fieldErrors.favorite = ['Favorite must be true or false.'];
    if (typeof toRead !== 'boolean') fieldErrors.toRead = ['To read must be true or false.'];
    if (Object.keys(fieldErrors).length) throw new ValidationError('Please correct the highlighted fields.', fieldErrors);
    const draft = typeof input.metadataDraftId === 'string' ? this.drafts.get(input.metadataDraftId) : null;
    if (input.metadataDraftId && (!draft || draft.normalizedUrl !== normalizedUrl)) throw new ValidationError('The page details have expired or belong to another address.', { metadataDraftId: ['Retrieve page details again.'] });
    const sameUrl = existing ? normalizeUrl(existing.url) === normalizedUrl : false;
    return { url, normalizedUrl, title, description, notes, notesText: noteToPlainText(notes), tags, favorite: favorite as boolean, toRead: toRead as boolean,
      iconAssetId: draft?.iconAssetId ?? (sameUrl && existing?.iconAssetUrl ? existing.iconAssetUrl.split('/').pop() : null),
      previewAssetId: draft?.previewAssetId ?? (sameUrl && existing?.previewAssetUrl ? existing.previewAssetUrl.split('/').pop() : null),
      metadataRefreshedAt: draft ? Date.now() : existing?.metadataRefreshedAt ? Date.parse(existing.metadataRefreshedAt) : null };
  }

  create(input: BookmarkInput): Bookmark {
    const write = this.validated(input); const duplicate = this.bookmarks.findDuplicate(write.normalizedUrl);
    if (duplicate) throw new AppError(409,'DUPLICATE_BOOKMARK','This link is already saved.',{ bookmark: duplicate });
    try { return this.bookmarks.create(write); } catch (error) {
      if (String(error).includes('UNIQUE')) { const target = this.bookmarks.findDuplicate(write.normalizedUrl); throw new AppError(409,'DUPLICATE_BOOKMARK','This link is already saved.',{ bookmark: target }); }
      throw error;
    }
  }

  update(id: string, input: BookmarkInput): Bookmark {
    const existing = this.get(id);
    if (Object.keys(input).length === 0) throw new ValidationError('Include at least one field to update.');
    if (Object.keys(input).every((key) => ['favorite','toRead'].includes(key))) {
      const favorite = input.favorite === undefined ? undefined : typeof input.favorite === 'boolean' ? input.favorite : (() => { throw new ValidationError('Favorite must be true or false.'); })();
      const toRead = input.toRead === undefined ? undefined : typeof input.toRead === 'boolean' ? input.toRead : (() => { throw new ValidationError('To read must be true or false.'); })();
      return this.bookmarks.patchFlags(id,{ favorite, toRead })!;
    }
    const write = this.validated(input, existing); const duplicate = this.bookmarks.findDuplicate(write.normalizedUrl,id);
    if (duplicate) throw new AppError(409,'DUPLICATE_BOOKMARK','This link is already saved.',{ bookmark: duplicate });
    try { return this.bookmarks.update(id,write)!; } catch (error) {
      if (String(error).includes('UNIQUE')) { const target = this.bookmarks.findDuplicate(write.normalizedUrl,id); throw new AppError(409,'DUPLICATE_BOOKMARK','This link is already saved.',{ bookmark: target }); }
      throw error;
    }
  }

  archive(id: string) { const value = this.bookmarks.archive(id,true); if (!value) throw new AppError(404,'NOT_FOUND','Bookmark not found.'); return value; }
  restore(id: string) { const value = this.bookmarks.archive(id,false); if (!value) throw new AppError(404,'NOT_FOUND','Bookmark not found.'); return value; }
  delete(id: string): void { if (!this.bookmarks.delete(id)) throw new AppError(404,'NOT_FOUND','Bookmark not found.'); this.media.cleanupUnreferenced(); }
}
