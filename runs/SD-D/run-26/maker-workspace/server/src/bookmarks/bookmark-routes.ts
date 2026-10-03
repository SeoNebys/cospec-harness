import { Router } from 'express';
import {
  BookmarkCreateSchema,
  BookmarkUpdateSchema,
  BulkRequestSchema,
  CollectionSchema,
  SortSchema
} from '@shared/contracts.js';
import { AppError } from '@shared/errors.js';
import type { BookmarkRepository } from './bookmark-repository.js';
import type { BookmarkService } from './bookmark-service.js';
import type { BulkService } from './bulk-service.js';
import type { MetadataService } from '../metadata/metadata-service.js';
export function bookmarkRouter(
  repo: BookmarkRepository,
  service: BookmarkService,
  metadata: MetadataService,
  bulk: BulkService
) {
  const r = Router();
  r.get('/', (req, res) => {
    const collection = CollectionSchema.parse(req.query.collection ?? 'active'),
      sort = SortSchema.parse(req.query.sort ?? 'recent');
    const result = repo.list({
      collection,
      sort,
      query: String(req.query.q ?? ''),
      tag: req.query.tag ? String(req.query.tag) : undefined,
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0)
    });
    res.json({ ...result, counts: repo.counts() });
  });
  r.post('/', (req, res) => {
    const input = BookmarkCreateSchema.parse(req.body);
    const proposal = metadata.consume(input.proposalToken, input.url);
    const bookmark = service.create(
      input,
      proposal
        ? {
            title: proposal.title,
            description: proposal.description,
            iconAssetId: input.acceptIcon === false ? null : proposal.iconAssetId
          }
        : undefined
    );
    res.status(201).json(bookmark);
  });
  r.post('/bulk', (req, res) => res.json(bulk.apply(BulkRequestSchema.parse(req.body))));
  r.get('/:id', (req, res) => {
    const b = repo.get(req.params.id);
    if (!b) throw new AppError(404, 'NOT_FOUND', 'Bookmark not found.');
    res.json(b);
  });
  r.patch('/:id', (req, res) => {
    const input = BookmarkUpdateSchema.parse(req.body);
    const existing = repo.get(req.params.id);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Bookmark not found.');
    const accepted = input.iconAssetToken
      ? metadata.consume(input.iconAssetToken, input.url ?? existing.url)
      : null;
    res.json(service.update(req.params.id, input, accepted?.iconAssetId));
  });
  r.delete('/:id', (req, res) => {
    if (req.query.confirm !== 'permanent')
      throw new AppError(422, 'BAD_REQUEST', 'Confirm permanent deletion explicitly.');
    if (!repo.delete(req.params.id)) throw new AppError(404, 'NOT_FOUND', 'Bookmark not found.');
    res.status(204).end();
  });
  r.post('/:id/metadata-preview', async (req, res) => {
    const b = repo.get(req.params.id);
    if (!b) throw new AppError(404, 'NOT_FOUND', 'Bookmark not found.');
    res.json(await metadata.preview(b.url));
  });
  return r;
}
