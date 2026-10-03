export type PageInfo = {
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  code?: string;
  errors?: Array<{ field: string; code: string; message: string }>;
  requestId?: string;
};
