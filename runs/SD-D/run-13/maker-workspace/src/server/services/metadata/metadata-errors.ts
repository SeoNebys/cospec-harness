export type MetadataWarning = 'timeout' | 'unreachable' | 'too_large' | 'unsupported_content' | 'missing_title' | 'missing_description' | 'missing_icon' | 'missing_preview';

export class MetadataFetchError extends Error {
  constructor(public readonly warning: MetadataWarning, message: string) { super(message); }
}
