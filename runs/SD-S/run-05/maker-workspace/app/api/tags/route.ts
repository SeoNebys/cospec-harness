import { NextResponse } from "next/server";
import { listTags } from "@/lib/server/bookmarks";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export function GET(){return NextResponse.json({tags:listTags()});}
