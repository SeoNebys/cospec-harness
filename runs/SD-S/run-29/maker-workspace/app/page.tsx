import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
export default async function Home() { redirect((await getCurrentUser()) ? "/bookmarks" : "/login"); }
