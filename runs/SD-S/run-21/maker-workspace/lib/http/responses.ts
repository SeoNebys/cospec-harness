import { NextResponse } from "next/server";
import { AppProblem } from "./problem";

export function problem(error: unknown) {
  if (error instanceof AppProblem)
    return NextResponse.json(
      {
        type: "about:blank",
        title: error.title,
        status: error.status,
        detail: error.detail,
        errors: error.errors,
        ...error.extra
      },
      {
        status: error.status,
        headers: { "content-type": "application/problem+json" }
      }
    );
  console.error("Unexpected request failure", error);
  return NextResponse.json(
    {
      type: "about:blank",
      title: "Something went wrong",
      status: 500,
      detail: "The request could not be completed."
    },
    { status: 500, headers: { "content-type": "application/problem+json" } }
  );
}
