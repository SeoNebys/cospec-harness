export type ErrorCode = "validation_error" | "duplicate_url" | "not_found" | "unsupported_media_type" | "rate_limited" | "internal_error";
export interface ApiError { error: { code: ErrorCode; message: string; field?: string; existingBookmarkId?: string } }
