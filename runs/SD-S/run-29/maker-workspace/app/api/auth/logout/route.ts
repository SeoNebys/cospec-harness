import { destroySession } from "@/lib/auth/server";
export async function POST() { await destroySession(); return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } }); }
