import { NextResponse } from "next/server";

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
  [key: string]: unknown;
};

export function problem(status: number, title: string, detail?: string, extra: Record<string, unknown> = {}) {
  const body: Problem = {
    type: `https://safekeep.local/problems/${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    title,
    status,
    ...(detail ? { detail } : {}),
    ...extra,
  };
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/problem+json", "cache-control": "no-store" },
  });
}

export const unauthorized = () => problem(401, "Authentication required", "Please sign in and try again.");
export const notFound = () => problem(404, "Bookmark not found", "It may have been removed or is not available to this account.");
