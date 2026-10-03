import { useEffect, useRef, useState } from 'react';

import type {
  Bookmark,
  BookmarkInput,
  MetadataOutcome,
  ReadingState,
} from '../../../shared/contracts.js';
import { bookmarkInputSchema, bookmarkUrlSchema } from '../../../shared/schemas.js';
import {
  createBookmark,
  isApiError,
  isDuplicateBookmarkError,
  replaceBookmark,
} from '../../api/bookmarks.js';
import { previewPageMetadata } from '../../api/metadata.js';

export type MetadataFormStatus = 'idle' | 'loading' | MetadataOutcome;

export interface BookmarkFormFields {
  url: string;
  title: string;
  description: string;
  tags: string;
  readingState: ReadingState;
}

const INITIAL_FIELDS: BookmarkFormFields = {
  url: '',
  title: '',
  description: '',
  tags: '',
  readingState: 'untracked',
};

function fieldErrorsFromValidation(input: BookmarkInput): Record<string, string> {
  const parsed = bookmarkInputSchema.safeParse(input);
  if (parsed.success) return {};
  return Object.fromEntries(
    parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'request'), issue.message]),
  );
}

export function useBookmarkForm(
  onSaved: (bookmark: Bookmark) => void,
  existingBookmark?: Bookmark,
) {
  const [fields, setFields] = useState<BookmarkFormFields>(() =>
    existingBookmark
      ? {
          url: existingBookmark.url,
          title: existingBookmark.title,
          description: existingBookmark.description,
          tags: existingBookmark.tags.join(', '),
          readingState: existingBookmark.readingState,
        }
      : INITIAL_FIELDS,
  );
  const [metadataStatus, setMetadataStatus] = useState<MetadataFormStatus>('idle');
  const [metadataMessage, setMetadataMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState('');
  const [duplicate, setDuplicate] = useState<Bookmark | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const generation = useRef(0);
  const titleVersion = useRef(existingBookmark ? 1 : 0);
  const descriptionVersion = useRef(existingBookmark ? 1 : 0);
  const automaticTitle = useRef(false);
  const automaticDescription = useRef(false);

  const setUrl = (url: string) => {
    generation.current += 1;
    setDuplicate(null);
    setFields((current) => ({
      ...current,
      url,
      title: automaticTitle.current ? '' : current.title,
      description: automaticDescription.current ? '' : current.description,
    }));
    if (automaticTitle.current) automaticTitle.current = false;
    if (automaticDescription.current) automaticDescription.current = false;
  };

  const setTitle = (title: string) => {
    titleVersion.current += 1;
    automaticTitle.current = false;
    setFields((current) => ({ ...current, title }));
  };

  const setDescription = (description: string) => {
    descriptionVersion.current += 1;
    automaticDescription.current = false;
    setFields((current) => ({ ...current, description }));
  };

  useEffect(() => {
    const parsedUrl = bookmarkUrlSchema.safeParse(fields.url);
    if (!parsedUrl.success) {
      setMetadataStatus('idle');
      setMetadataMessage('');
      return;
    }

    const requestGeneration = generation.current;
    const requestTitleVersion = titleVersion.current;
    const requestDescriptionVersion = descriptionVersion.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setMetadataStatus('loading');
      setMetadataMessage('Retrieving page information…');
      void Promise.all([
        previewPageMetadata({ url: parsedUrl.data }, { signal: controller.signal }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 200)),
      ])
        .then(([preview]) => {
          if (generation.current !== requestGeneration) return;
          if (titleVersion.current === requestTitleVersion && preview.title !== null) {
            setFields((current) => {
              if (current.title !== '') return current;
              automaticTitle.current = true;
              return { ...current, title: preview.title ?? current.title };
            });
          }
          if (
            descriptionVersion.current === requestDescriptionVersion &&
            preview.description !== null
          ) {
            setFields((current) => ({
              ...(current.description === ''
                ? (() => {
                    automaticDescription.current = true;
                    return { ...current, description: preview.description ?? '' };
                  })()
                : current),
            }));
          }
          setMetadataStatus(preview.outcome);
          setMetadataMessage(
            preview.message ??
              (preview.outcome === 'complete'
                ? 'Page information is ready.'
                : preview.outcome === 'partial'
                  ? 'Page information is incomplete. Add anything missing manually.'
                  : 'Page information is unavailable. Enter a title manually.'),
          );
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || generation.current !== requestGeneration) return;
          setMetadataStatus('unavailable');
          setMetadataMessage(
            isApiError(error)
              ? `${error.message} Enter a title manually.`
              : 'Page information is unavailable. Enter a title manually.',
          );
        });
    }, 100);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fields.url]);

  const input = (allowDuplicate = false): BookmarkInput => ({
    url: fields.url,
    title: fields.title,
    description: fields.description,
    tags: fields.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    readingState: fields.readingState,
    allowDuplicate,
  });

  const submit = async (allowDuplicate = false): Promise<boolean> => {
    const payload = input(allowDuplicate);
    const validationErrors = fieldErrorsFromValidation(payload);
    setFieldErrors(validationErrors);
    setSubmitMessage('');
    setDuplicate(null);
    if (Object.keys(validationErrors).length > 0) return false;

    setSubmitting(true);
    try {
      const saved = existingBookmark
        ? await replaceBookmark(existingBookmark.id, payload)
        : await createBookmark(payload);
      onSaved(saved);
      generation.current += 1;
      titleVersion.current = 0;
      descriptionVersion.current = 0;
      automaticTitle.current = false;
      automaticDescription.current = false;
      setFields(INITIAL_FIELDS);
      setMetadataStatus('idle');
      setMetadataMessage('');
      return true;
    } catch (error) {
      if (isDuplicateBookmarkError(error)) {
        setDuplicate(error.existingBookmark);
        setSubmitMessage(error.message);
      } else if (isApiError(error)) {
        setFieldErrors(error.fieldErrors ?? {});
        setSubmitMessage(error.message);
      } else {
        setSubmitMessage('The bookmark could not be saved. Try again.');
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    fields,
    setUrl,
    setTitle,
    setDescription,
    setTags: (tags: string) => setFields((current) => ({ ...current, tags })),
    setReadingState: (readingState: ReadingState) =>
      setFields((current) => ({ ...current, readingState })),
    metadataStatus,
    metadataMessage,
    fieldErrors,
    submitMessage,
    duplicate,
    submitting,
    submit,
  };
}
