export type FieldErrors = Record<string, string>;

export type ApiErrorPayload = {
  code: string;
  message: string;
  requestId?: string;
  fieldErrors?: FieldErrors;
  existingBookmark?: { id: number; title: string; url: string };
};

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiErrorPayload
  ) {
    super(payload.message);
  }
}
