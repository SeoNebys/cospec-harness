import { ZodError } from "zod";
import { AppProblem } from "@/lib/http/problem";
import {
  bookmarkInputSchema,
  bookmarkPatchSchema
} from "@/lib/validation/bookmark";
import { normalizeUrl } from "./normalize-url";
import { BookmarkRepository } from "./repository";
import type { BookmarkQuery } from "./types";

function validation(error: ZodError) {
  const flat = error.flatten().fieldErrors;
  throw new AppProblem(
    422,
    "Check the bookmark details",
    "Some fields need your attention.",
    flat as Record<string, string[]>
  );
}
export class BookmarkService {
  constructor(private repo = new BookmarkRepository()) {}
  get(id: string) {
    const item = this.repo.get(id);
    if (!item)
      throw new AppProblem(
        404,
        "Bookmark not found",
        "That bookmark no longer exists."
      );
    return item;
  }
  create(raw: unknown) {
    let input;
    try {
      input = bookmarkInputSchema.parse(raw);
    } catch (e) {
      if (e instanceof ZodError) validation(e);
      throw e;
    }
    const normalizedUrl = normalizeUrl(input.url);
    const duplicate = this.repo.duplicate(normalizedUrl);
    if (duplicate && !input.allowDuplicate)
      throw new AppProblem(
        409,
        "Bookmark already saved",
        "You can edit the existing bookmark or save another copy.",
        undefined,
        { duplicate }
      );
    return this.repo.create({ ...input, normalizedUrl });
  }
  update(id: string, raw: unknown) {
    this.get(id);
    let input;
    try {
      input = bookmarkPatchSchema.parse(raw);
    } catch (e) {
      if (e instanceof ZodError) validation(e);
      throw e;
    }
    const normalizedUrl = input.url ? normalizeUrl(input.url) : undefined;
    if (normalizedUrl) {
      const duplicate = this.repo.duplicate(normalizedUrl, id);
      if (duplicate && !input.allowDuplicate)
        throw new AppProblem(
          409,
          "Bookmark already saved",
          "Another bookmark uses this address.",
          undefined,
          { duplicate }
        );
    }
    return this.repo.update(id, { ...input, normalizedUrl });
  }
  list(q: BookmarkQuery) {
    return this.repo.list(q);
  }
  archive(id: string) {
    const item = this.get(id);
    if (item.archived)
      throw new AppProblem(
        409,
        "Already archived",
        "This bookmark is already in the archive."
      );
    return this.repo.setArchived(id, true);
  }
  restore(id: string) {
    const item = this.get(id);
    if (!item.archived)
      throw new AppProblem(
        409,
        "Already active",
        "This bookmark is already in the library."
      );
    return this.repo.setArchived(id, false);
  }
  delete(id: string) {
    this.get(id);
    this.repo.delete(id);
  }
  tags() {
    return this.repo.tags();
  }
}
