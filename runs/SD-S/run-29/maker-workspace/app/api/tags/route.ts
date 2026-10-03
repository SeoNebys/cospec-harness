import { getCurrentUser } from "@/lib/auth/server";
import { listTags } from "@/lib/dal/bookmarks";
import { privateJson, problem } from "@/lib/http/problem";
export async function GET() { const user = await getCurrentUser(); return user ? privateJson({ items: await listTags(user.id) }) : problem(401, "UNAUTHENTICATED", "Sign in to view tags."); }
