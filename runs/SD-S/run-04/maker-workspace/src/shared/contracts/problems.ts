export type FieldIssue = { field: string; message: string };
export type Problem = {
  code: string;
  message: string;
  issues?: FieldIssue[];
  existingBookmark?: unknown;
};

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Partial<Problem> = {},
  ) {
    super(message);
  }
}
