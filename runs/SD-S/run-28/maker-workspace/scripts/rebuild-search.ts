import { getDb } from "@/lib/db/client";import { migrate } from "@/lib/db/migrate";import { rebuildSearch } from "@/lib/bookmarks/repository";
migrate(getDb()); console.log(`Rebuilt ${rebuildSearch()} search rows.`);
