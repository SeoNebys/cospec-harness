import { NextRequest, NextResponse } from "next/server";
import { previewMetadata } from "@/lib/metadata/service";
import { problem } from "@/lib/http/responses";
import { AppProblem } from "@/lib/http/problem";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body.url !== "string")
      throw new AppProblem(
        400,
        "Web address required",
        "Enter the page you want to save."
      );
    return NextResponse.json(await previewMetadata(body.url));
  } catch (e) {
    return problem(e);
  }
}
