import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../lib/db/client";
import { normalizeForSearch } from "../../lib/text/normalize";

export async function seedBookmarks(client: DatabaseClient, count = 10_000): Promise<void> {
  const epoch = Date.UTC(2020, 0, 1);
  const batchSize = 500;
  for (let offset = 0; offset < count; offset += batchSize) {
    const size = Math.min(batchSize, count - offset);
    await client.bookmark.createMany({ data: Array.from({ length: size }, (_, index) => {
      const number = offset + index;
      const title = `Reference ${number.toString().padStart(5, "0")}`;
      const url = `https://example.com/articles/${number}?group=${number % 10}`;
      const note = number % 17 === 0 ? "special performance needle" : `Note ${number}`;
      return {
        id: randomUUID(), url, urlKey: url, urlSearch: normalizeForSearch(url),
        title, titleSearch: normalizeForSearch(title), titleOrigin: "user", note,
        noteSearch: normalizeForSearch(note), createdAt: new Date(epoch + number * 1000),
        updatedAt: new Date(epoch + number * 1000),
      };
    }) });
  }
}
