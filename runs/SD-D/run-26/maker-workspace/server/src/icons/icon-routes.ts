import { Router } from 'express';
import { AppError } from '@shared/errors.js';
import type { IconRepository } from './icon-repository.js';
export function iconRouter(repo: IconRepository) {
  return Router().get('/:hash', (req, res) => {
    if (!/^[0-9a-f]{64}$/.test(req.params.hash))
      throw new AppError(404, 'NOT_FOUND', 'Icon not found.');
    const icon = repo.get(req.params.hash);
    if (!icon) throw new AppError(404, 'NOT_FOUND', 'Icon not found.');
    res
      .set({
        'Content-Type': icon.mimeType,
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
      })
      .send(icon.bytes);
  });
}
