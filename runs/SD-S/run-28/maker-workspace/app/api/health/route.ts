import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
export function GET() { try { getDb().prepare("SELECT 1").get(); return NextResponse.json({status:"ok"}); } catch { return NextResponse.json({code:"NOT_READY",message:"Application is not ready",requestId:crypto.randomUUID()},{status:503}); } }
