import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Context) {
  const token = (await context.params).token;
  if (!/^[a-f0-9-]+\.png$/i.test(token)) return new NextResponse(null, { status: 404 });
  const root = resolve(process.cwd(), "data/icons");
  const path = resolve(root, token);
  if (!path.startsWith(`${root}${sep}`)) return new NextResponse(null, { status: 404 });
  try {
    const body = await readFile(path);
    return new NextResponse(body, { headers: {
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable"
    } });
  } catch { return new NextResponse(null, { status: 404 }); }
}
