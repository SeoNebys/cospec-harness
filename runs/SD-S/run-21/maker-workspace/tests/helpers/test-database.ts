import { createDb } from "@/lib/db/client";
export function isolatedDatabase() {
  return createDb(":memory:");
}
