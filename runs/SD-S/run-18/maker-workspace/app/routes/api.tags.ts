import type { LoaderFunctionArgs } from "react-router";
import { requireResourceUser } from "~/auth/require-user.server";
import { db } from "~/db/client.server";
import { createTagRepository } from "~/features/bookmarks/tag.repository.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireResourceUser(request);
  return Response.json({ items: createTagRepository(db).listWithCounts(user.id) });
}
